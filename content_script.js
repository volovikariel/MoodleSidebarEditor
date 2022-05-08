function start_mutation_observer() {
    let processedCourseElements = new Set()
    chrome.storage.sync.get({ 'savedCourses': {} }, ({ savedCourses }) => {
        function onMutation() {
            const loggedIn = document.querySelector(".login") === null
            if (!loggedIn) {
                observer.disconnect()
                return
            }

            const courseElements = getCourseElementsInDOM()
            const courseElementsUnprocessed = courseElements.length > processedCourseElements.size
            if (courseElementsUnprocessed) {
                processCourseElements(savedCourses, courseElements, processedCourseElements)
            }

            // The page header gets updated AFTER the courseList is updated - so once it's in the page, we know the courseElements are too
            const sidebarFullyLoaded = document.querySelector('header#page-header.row') !== null
            if (sidebarFullyLoaded) {
                // Go through it once more in case some elements were not fully processed
                if (courseElementsUnprocessed) {
                    updateSidebar()
                }
                observer.disconnect()
                chrome.storage.sync.set({ 'savedCourses': generateCourseVisibilities(savedCourses) });
            }
        }
        const observer = new MutationObserver(onMutation);
        observer.observe(document, { childList: true, subtree: true });

        // In case the content script has been injected when some of the DOM has already loaded
        onMutation();
    });
}

function processCourseElements(savedCourses, courseElements, processedCourseElements) {
    const courseVisibilities = generateCourseVisibilities(savedCourses)
    courseElements
        .filter(courseElement => !processedCourseElements.has(courseElement))
        // If the course element hasn't been fully loaded yet (no innerText yet), skip it
        .filter(courseElement => typeof getCourseElementInnerText(courseElement) !== "undefined" && getCourseElementInnerText(courseElement) !== "")
        .forEach(courseElement => {
            const courseName = getCourseElementInnerText(courseElement)
            const courseShouldBeVisible = courseVisibilities[courseName];
            setCourseElementVisibility(courseElement, courseShouldBeVisible);
            processedCourseElements.add(courseElement)
        })
}

function getCourseElementsInDOM() {
    const COURSE_ELEMENT_SELECTOR = 'ul > li > a[data-parent-key="mycourses"]'
    return Array.from(document.querySelectorAll(COURSE_ELEMENT_SELECTOR))
}

function getCourseElementInnerText(courseElement) {
    const COURSE_ELEMENT_TEXT_CONTAINER_SELECTOR = 'a[data-parent-key="mycourses"] > div > div > span.media-body'
    return courseElement.querySelector(COURSE_ELEMENT_TEXT_CONTAINER_SELECTOR)?.innerText
}

function generateCourseVisibilities(savedCourses) {
    // Turns [[a, b], [b,c]] into { a:b, b:c }
    return Object.fromEntries(getCourseElementsInDOM().map(courseElement => {
        const courseName = getCourseElementInnerText(courseElement)
        const isShown = savedCourses[courseName] ?? true
        return [courseName, isShown]
    }))
}

function updateSidebar() {
    chrome.storage.sync.get({ "savedCourses": {} }, ({ savedCourses }) => {
        for (let courseElement of getCourseElementsInDOM()) {
            const courseName = getCourseElementInnerText(courseElement)
            const isShown = savedCourses[courseName]
            setCourseElementVisibility(courseElement, isShown)
        }
    })
}

function setCourseElementVisibility(courseElement, isShown) {
    if (isShown) {
        courseElement.style.display = "block"
    } else if (isShown === false) {
        courseElement.style.display = "none"
    }
}

function setup_listener() {
    chrome.runtime.onMessage.addListener(({ receiver, action }, _, sendResponse) => {
        if (receiver === "content_script") {
            switch (action) {
                case "updateSidebar":
                    updateSidebar()
                    break;
                case "getCourseElements":
                    sendResponse(getCourseElementsInDOM())
                    break;
                default:
                    throw new Error("Improper action specified")
            }
        }

        // Bug: https://bugs.chromium.org/p/chromium/issues/detail?id=1304272
        sendResponse()
    })
}

function main() {
    start_mutation_observer()
    setup_listener()
}

main()