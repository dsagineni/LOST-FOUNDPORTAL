// MESSAGE
const message = document.getElementById("message");

// LOST FORM
const lostForm = document.getElementById("lostForm");

lostForm.addEventListener("submit", function(e) {
    e.preventDefault();

    const item = document.getElementById("lostItem").value;
    const desc = document.getElementById("lostDesc").value;

    message.textContent = "✅ Lost item submitted: " + item;

    console.log("Lost Item:", item);
    console.log("Description:", desc);

    lostForm.reset();
});


// FOUND FORM
const foundForm = document.getElementById("foundForm");

foundForm.addEventListener("submit", function(e) {
    e.preventDefault();

    const item = document.getElementById("foundItem").value;

    const questions = document.querySelectorAll(".q");
    let qList = [];

    questions.forEach(q => {
        qList.push(q.value);
    });

    message.textContent = "🎉 Found item submitted: " + item;

    console.log("Found Item:", item);
    console.log("Questions:", qList);

    foundForm.reset();
});