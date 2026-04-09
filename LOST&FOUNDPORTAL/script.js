// PAGE SWITCH
function showPage(page) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));

    if (page === "home") document.getElementById("homePage").classList.add("active");
    if (page === "lost") document.getElementById("lostPage").classList.add("active");
    if (page === "found") document.getElementById("foundPage").classList.add("active");
}

// STORAGE
let lostItems = JSON.parse(localStorage.getItem("lost")) || [];
let foundItems = JSON.parse(localStorage.getItem("found")) || [];
let notifications = [];

// 🔔 TOGGLE
function toggleNotifications() {
    const box = document.getElementById("notificationBox");
    box.style.display = box.style.display === "block" ? "none" : "block";
}

// 🔔 ADD NOTIFICATION
function notify(msg) {
    notifications.unshift(msg);

    const box = document.getElementById("notificationBox");
    const badge = document.getElementById("badge");

    box.innerHTML = "";
    notifications.forEach(n => {
        box.innerHTML += `<div>${n}</div>`;
    });

    badge.textContent = notifications.length;
}

// RENDER
function render() {
    const lostList = document.getElementById("lostList");
    const foundList = document.getElementById("foundList");
    const recent = document.getElementById("recentItems");

    lostList.innerHTML = "";
    foundList.innerHTML = "";
    recent.innerHTML = "";

    lostItems.forEach(item => {
        lostList.innerHTML += `<div class="item">🔴 ${item.name}</div>`;
        recent.innerHTML += `<div class="item">Lost: ${item.name}</div>`;
    });

    foundItems.forEach(item => {
        foundList.innerHTML += `<div class="item">🟢 ${item.name}</div>`;
        recent.innerHTML += `<div class="item">Found: ${item.name}</div>`;
    });
}

// LOST FORM
document.getElementById("lostForm").addEventListener("submit", function(e) {
    e.preventDefault();

    const item = document.getElementById("lostItem").value;
    const desc = document.getElementById("lostDesc").value;

    lostItems.push({ name: item, desc });
    localStorage.setItem("lost", JSON.stringify(lostItems));

    notify("Lost item: " + item);
    render();
    this.reset();
});

// FOUND FORM
document.getElementById("foundForm").addEventListener("submit", function(e) {
    e.preventDefault();

    const item = document.getElementById("foundItem").value;
    const questions = [...document.querySelectorAll(".q")].map(q => q.value);

    foundItems.push({ name: item, questions });
    localStorage.setItem("found", JSON.stringify(foundItems));

    notify("Found item: " + item);
    render();
    this.reset();
});

// INIT
render();