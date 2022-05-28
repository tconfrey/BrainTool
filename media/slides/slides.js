/* Add classes for styling */

Array.from(document.getElementsByTagName('ul')).map((e) => e.nextElementSibling).forEach((e2) => e2 && e2.classList.add('subtext'));


Reveal.initialize({
    // Make the browser back button work.
    hash: true,
    history: true,
//    plugins: [RevealMarkdown, RevealZoom, RevealNotes]
    plugins: []
});
