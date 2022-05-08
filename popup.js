const noCoursesFoundText = document.getElementById('noCoursesFoundText')
const wrongPageText = document.getElementById('wrongPageText')

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs[0];

    if (tab.url.startsWith("https://moodle.concordia.ca")) {
        wrongPageText.style.display = "none"
        chrome.tabs.sendMessage(tab.id, { receiver: "content_script", action: "getCourseElements" }, (courseElements) => {
            if (courseElements?.length > 0) {
                noCoursesFoundText.style.display = "none"
                populate_course_list_element()
            } else {
                noCoursesFoundText.style.display = "initial"
            }
        })
    } else {
        wrongPageText.style.display = "initial"
    }
});

function populate_course_list_element() {
    chrome.storage.sync.get("savedCourses", ({ savedCourses }) => {
        const course_list = document.getElementById('content')
        for (let [courseName, isShown] of Object.entries(savedCourses)) {
            course_list.append(create_course_element(courseName, isShown))
        }
    })
}

function create_course_element(courseName, isShown) {
    const courseLabel = document.createTextNode(courseName)
    const courseShownCheckbox = document.createElement('input')
    courseShownCheckbox.type = 'checkbox'
    courseShownCheckbox.checked = isShown

    courseShownCheckbox.addEventListener('change', function () {
        toggle_course_visibility(courseName, this.checked)
    })

    const course_div = document.createElement('div')
    course_div.id = courseName
    course_div.appendChild(courseLabel)
    course_div.appendChild(courseShownCheckbox)


    toggle_course_visibility(courseName, isShown)
    return course_div
}

function toggle_course_visibility(course_name, isChecked) {
    chrome.storage.sync.get({ "savedCourses": {} }, ({ savedCourses }) => {
        // Update state
        savedCourses[course_name] = isChecked
        chrome.storage.sync.set({ "savedCourses": savedCourses }, () => {
            // Send message to content script
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                const tab = tabs[0];
                // Now that its been set, update the sidebar to reflect that
                chrome.tabs.sendMessage(tab.id, { receiver: "content_script", action: "updateSidebar" })
            })
        })
    })
}