function start_mutation_observer() {
    let processedCourseElements = new Set()
    chrome.storage.sync.get({ 'savedCourses': {} }, ({ savedCourses }) => {
        function onMutation(mutations) {
            for (const { addedNodes } of mutations) {
                for (const node of addedNodes) {
                    const courseElements = getCourseElements()
                    const courseElementsAdded = courseElements.length > processedCourseElements.size
                    // If a courseElement was added, update visibility of those that weren't already processed 
                    if (courseElementsAdded) {
                        const generatedCourses = generateCourseList(savedCourses)
                        courseElements
                            .filter(courseElement => !processedCourseElements.has(courseElement))
                            .forEach(courseElement => {
                                const courseName = getCourseElementTextContent(courseElement)
                                const courseShouldBeVisible = generatedCourses[courseName];
                                setCourseElementVisibility(courseElement, courseShouldBeVisible);
                                processedCourseElements.add(courseElement)
                            })
                    }

                    // The page header gets updated AFTER the courseList is updated - so once it's in the page, we know the courseElements are too
                    if (document.querySelector('header#page-header.row')) {
                        observer.disconnect()
                        chrome.storage.sync.set({ 'savedCourses': generateCourseList(savedCourses) });
                        return
                    }
                }
            }
        }
        const observer = new MutationObserver(onMutation);
        observer.observe(document, { childList: true, subtree: true });

        // In case the content script has been injected when some of the DOM has already loaded
        onMutation([{ addedNodes: [document.documentElement] }]);
    });
}

function getCourseElements() {
    const COURSE_ELEMENT_SELECTOR = 'ul > li > a[data-parent-key="mycourses"]'
    return Array.from(document.querySelectorAll(COURSE_ELEMENT_SELECTOR))
}

function getCourseElementTextContent(courseElement) {
    const COURSE_ELEMENT_TEXT_CONTAINER_SELECTOR = 'a[data-parent-key="mycourses"] > div > div > span.media-body'
    return courseElement.querySelector(COURSE_ELEMENT_TEXT_CONTAINER_SELECTOR).textContent
}

function generateCourseList(savedCourses) {
    // Turns [[a, b], [b,c]] into {a:b, b:c}
    return Object.fromEntries(getCourseElements().map(courseElement => {
        const courseName = getCourseElementTextContent(courseElement)
        const isShown = savedCourses[courseName] ?? true
        return [courseName, isShown]
    }))
}

function updateSidebar() {
    chrome.storage.sync.get({ "savedCourses": {} }, ({ savedCourses }) => {
        for (let courseElement of getCourseElements()) {
            const courseName = getCourseElementTextContent(courseElement)
            const isShown = savedCourses[courseName]
            setCourseElementVisibility(courseElement, isShown)
        }
    })
}

function setCourseElementVisibility(courseElement, isShown) {
    if (isShown) {
        courseElement.style.display = "block"
    } else {
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
                    sendResponse(getCourseElements())
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