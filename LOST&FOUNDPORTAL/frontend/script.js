const state = {
    lostItems: [],
    foundItems: [],
    notifications: [],
    finderVault: null,
    latestClaimStatus: null,
    liveUpdatesConnected: false,
};
const REFRESH_INTERVAL_MS = 15000;

const tabs = document.querySelectorAll(".tab");
const workspaces = document.querySelectorAll(".workspace");
const questionTemplate = document.getElementById("questionRowTemplate");
const questionList = document.getElementById("questionList");
const notificationPanel = document.getElementById("notificationPanel");
const notificationBadge = document.getElementById("notificationBadge");

function switchTab(tabName) {
    tabs.forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.tab === tabName);
    });
    workspaces.forEach((workspace) => {
        const matches =
            (tabName === "lost" && workspace.id === "lostTab") ||
            (tabName === "found" && workspace.id === "foundTab") ||
            (tabName === "finder" && workspace.id === "finderTab");
        workspace.classList.toggle("active", matches);
    });
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
        },
        ...options,
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
    }
    return data;
}

function createQuestionRow(question = "") {
    const fragment = questionTemplate.content.cloneNode(true);
    const row = fragment.querySelector(".question-row");
    row.querySelector(".question-input").value = question;
    row.querySelector(".remove-question").addEventListener("click", () => {
        if (questionList.children.length > 3) {
            row.remove();
        }
    });
    questionList.appendChild(fragment);
}

function formatTime(value) {
    return new Date(value).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function renderLostItems() {
    const target = document.getElementById("lostItemsList");
    if (!state.lostItems.length) {
        target.innerHTML = `<div class="empty-state">No lost items yet. The first report will appear here.</div>`;
        return;
    }

    target.innerHTML = state.lostItems
        .map(
            (item) => `
                <article class="item-card glass-soft">
                    <div class="item-head">
                        <div>
                            <h4>${escapeHtml(item.item_name)}</h4>
                            <p>${escapeHtml(item.category)} &bull; ${escapeHtml(item.location)}</p>
                        </div>
                        <span class="status-chip">${escapeHtml(item.status)}</span>
                    </div>
                    <p>${escapeHtml(item.description)}</p>
                    <div class="meta-row">
                        <span>Owner: ${escapeHtml(item.owner_name)}</span>
                        <span>Contact: ${escapeHtml(item.contact_info)}</span>
                    </div>
                    <small>${formatTime(item.created_at)}</small>
                </article>
            `
        )
        .join("");
}

function renderFoundItems() {
    const target = document.getElementById("foundItemsList");
    if (!state.foundItems.length) {
        target.innerHTML = `<div class="empty-state">No found items yet. Public found reports will appear here.</div>`;
        return;
    }

    target.innerHTML = state.foundItems
        .map(
            (item) => `
                <article class="item-card glass-soft">
                    <div class="item-head">
                        <div>
                            <h4>${escapeHtml(item.item_name)}</h4>
                            <p>${escapeHtml(item.category)} &bull; ${escapeHtml(item.location)}</p>
                        </div>
                        <span class="status-chip">${escapeHtml(item.status)}</span>
                    </div>
                    <div class="question-preview">
                        <h5>Verification Questions</h5>
                        ${item.questions
                            .map(
                                (question, index) => `
                                    <label>
                                        <span>${index + 1}. ${escapeHtml(question.question_text)}</span>
                                        <input type="text" data-question-id="${question.id}" placeholder="Claimant answer" required>
                                    </label>
                                `
                            )
                            .join("")}
                    </div>
                    <form class="claim-form" data-item-id="${item.id}">
                        <label>
                            Claimant Name
                            <input type="text" name="claimant_name" required>
                        </label>
                        <label>
                            Claimant Contact
                            <input type="text" name="claimant_contact" required>
                        </label>
                        <label>
                            Why is this yours?
                            <textarea name="claimant_message" rows="3" required></textarea>
                        </label>
                        <button type="submit" class="secondary-button">Submit Verification Claim</button>
                    </form>
                    <div class="meta-row">
                        <span>Finder: ${escapeHtml(item.finder_name)}</span>
                        <span>Claims received: ${item.claim_count}</span>
                    </div>
                    <small>${formatTime(item.created_at)}</small>
                </article>
            `
        )
        .join("");

    document.querySelectorAll(".claim-form").forEach((form) => {
        form.addEventListener("submit", submitClaim);
    });
}

function renderNotifications() {
    const list = document.getElementById("notificationList");
    notificationBadge.textContent = state.notifications.length;

    if (!state.notifications.length) {
        list.innerHTML = `<div class="empty-state compact">No updates yet.</div>`;
        return;
    }

    list.innerHTML = state.notifications
        .map(
            (notification) => `
                <article class="notification-item">
                    <div class="item-head">
                        <strong>${escapeHtml(notification.title)}</strong>
                        <span class="notification-type">${escapeHtml(notification.type)}</span>
                    </div>
                    <p>${escapeHtml(notification.message)}</p>
                    <small>${formatTime(notification.created_at)}</small>
                </article>
            `
        )
        .join("");
}

function renderMetrics() {
    const lostCount = document.getElementById("lostCount");
    const foundCount = document.getElementById("foundCount");
    const updateCount = document.getElementById("updateCount");
    if (!lostCount || !foundCount || !updateCount) {
        return;
    }
    lostCount.textContent = state.lostItems.length;
    foundCount.textContent = state.foundItems.length;
    updateCount.textContent = state.notifications.length;
}

function renderFinderVault() {
    const target = document.getElementById("finderVaultContent");
    if (!state.finderVault) {
        target.className = "empty-state";
        target.textContent = "Open a found item to review its verification questions and submitted claimant responses.";
        return;
    }

    const item = state.finderVault;
    const accessKey = document.querySelector('#finderAccessForm [name="access_key"]').value;
    target.className = "vault-content";
    target.innerHTML = `
        <div class="vault-header">
            <div>
                <h4>${escapeHtml(item.item_name)}</h4>
                <p>${escapeHtml(item.category)} &bull; ${escapeHtml(item.location)}</p>
            </div>
            <span class="status-chip">${escapeHtml(item.status)}</span>
        </div>

        <div class="vault-section">
            <h5>Verification Questions</h5>
            ${item.verification_questions
                .map(
                    (entry) => `
                        <div class="vault-row">
                            <strong>${escapeHtml(entry.question_text)}</strong>
                            <span>Waiting for claimant response</span>
                        </div>
                    `
                )
                .join("")}
        </div>

        <div class="vault-section">
            <div class="vault-actions">
                <h5>Update Item Status</h5>
                <form id="statusForm" class="status-form">
                    <input type="hidden" name="item_id" value="${item.id}">
                    <input type="hidden" name="access_key" value="${escapeHtml(accessKey)}">
                    <select name="status">
                        <option ${item.status === "Awaiting Verification" ? "selected" : ""}>Awaiting Verification</option>
                        <option ${item.status === "Matched With Owner" ? "selected" : ""}>Matched With Owner</option>
                        <option ${item.status === "Returned" ? "selected" : ""}>Returned</option>
                    </select>
                    <button type="submit" class="secondary-button">Save Status</button>
                </form>
            </div>
        </div>

        <div class="vault-section">
            <h5>Claim Submissions</h5>
            ${
                item.claims.length
                    ? item.claims
                          .map(
                              (claim) => `
                                <article class="claim-card glass-soft">
                                    <div class="item-head">
                                        <div>
                                            <strong>${escapeHtml(claim.claimant_name)}</strong>
                                            <p>${escapeHtml(claim.claimant_contact)}</p>
                                        </div>
                                        <span class="status-chip">${escapeHtml(claim.status)}</span>
                                    </div>
                                    <p>${escapeHtml(claim.claimant_message)}</p>
                                    <div class="claim-answers">
                                        ${claim.answers
                                            .map(
                                                (answer) => `
                                                    <div class="vault-row">
                                                        <strong>${escapeHtml(answer.question_text)}</strong>
                                                        <span>${escapeHtml(answer.answer_text)}</span>
                                                    </div>
                                                `
                                            )
                                            .join("")}
                                    </div>
                                    <div class="claim-review-actions">
                                        <button
                                            type="button"
                                            class="secondary-button decision-button"
                                            data-claim-id="${claim.id}"
                                            data-decision="accept"
                                            ${claim.status === "Accepted" ? "disabled" : ""}
                                        >
                                            ${claim.status === "Accepted" ? "Accepted" : "Accept Claim"}
                                        </button>
                                        <button
                                            type="button"
                                            class="ghost-button decision-button"
                                            data-claim-id="${claim.id}"
                                            data-decision="reject"
                                            ${claim.status === "Rejected" ? "disabled" : ""}
                                        >
                                            ${claim.status === "Rejected" ? "Rejected" : "Reject Claim"}
                                        </button>
                                    </div>
                                    <small>${formatTime(claim.created_at)}</small>
                                </article>
                            `
                          )
                          .join("")
                    : `<div class="empty-state compact">No claims submitted yet.</div>`
            }
        </div>
    `;

    document.getElementById("statusForm").addEventListener("submit", updateFoundStatus);
    document.querySelectorAll(".decision-button").forEach((button) => {
        button.addEventListener("click", reviewClaimDecision);
    });
}

function renderClaimStatus() {
    const target = document.getElementById("claimStatusResult");
    if (!state.latestClaimStatus) {
        target.className = "empty-state compact";
        target.textContent = "Enter your claim ID and the same contact you used while submitting the claim.";
        return;
    }

    const claim = state.latestClaimStatus;
    const isAccepted = claim.status === "Accepted";
    target.className = isAccepted ? "result-banner compact success-banner" : "empty-state compact";
    target.innerHTML = `
        <strong>${escapeHtml(claim.item_name)}</strong>
        <div class="claim-status-copy">${escapeHtml(claim.message)}</div>
        <div class="meta-row">
            <span>Claim ID: ${claim.claim_id}</span>
            <span>Status: ${escapeHtml(claim.status)}</span>
        </div>
        ${
            isAccepted
                ? `
                    <div class="approval-card">
                        <strong>Finder Contact</strong>
                        <span>${escapeHtml(claim.finder_name)} - ${escapeHtml(claim.finder_contact)}</span>
                    </div>
                `
                : ""
        }
    `;
}

function renderAll() {
    renderLostItems();
    renderFoundItems();
    renderNotifications();
    renderMetrics();
    renderFinderVault();
    renderClaimStatus();
}

function applyDashboardData(data) {
    state.lostItems = data.lost_items;
    state.foundItems = data.found_items;
    state.notifications = data.notifications;
    renderAll();
}

async function refreshDashboard() {
    const data = await apiRequest("/api/dashboard");
    applyDashboardData(data);
}

async function refreshFinderVaultSilently() {
    const form = document.getElementById("finderAccessForm");
    if (!form || !state.finderVault) {
        return;
    }

    const payload = Object.fromEntries(new FormData(form).entries());
    if (!payload.found_item_id || !payload.access_key) {
        return;
    }

    try {
        const data = await apiRequest(`/api/found-items/${payload.found_item_id}/finder-access`, {
            method: "POST",
            body: JSON.stringify({ access_key: payload.access_key }),
        });
        state.finderVault = data.item;
        renderFinderVault();
    } catch (error) {
        console.error(error);
    }
}

function connectLiveUpdates() {
    if (!window.EventSource) {
        return;
    }

    const source = new EventSource("/api/events");
    source.addEventListener("open", () => {
        state.liveUpdatesConnected = true;
    });
    source.addEventListener("dashboard", (event) => {
        applyDashboardData(JSON.parse(event.data));
        refreshFinderVaultSilently();
        refreshClaimStatusSilently();
    });
    source.addEventListener("error", () => {
        state.liveUpdatesConnected = false;
    });
}

async function submitLostItem(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    await apiRequest("/api/lost-items", {
        method: "POST",
        body: JSON.stringify(payload),
    });
    form.reset();
    await refreshDashboard();
    window.alert("Lost report submitted successfully.");
}

async function submitFoundItem(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const questions = Array.from(questionList.querySelectorAll(".question-row")).map((row) => ({
        question_text: row.querySelector(".question-input").value.trim(),
    }));

    const data = await apiRequest("/api/found-items", {
        method: "POST",
        body: JSON.stringify({ ...payload, questions }),
    });

    form.reset();
    questionList.innerHTML = "";
    initializeQuestions();

    const banner = document.getElementById("finderAccessResult");
    banner.classList.remove("hidden");
    banner.innerHTML = `
        <strong>Private finder access created.</strong>
        Item ID: <strong>${data.item.id}</strong>
        Access Key: <strong>${escapeHtml(data.finder_access_key)}</strong>
    `;

    await refreshDashboard();
    switchTab("found");
}

async function submitClaim(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const itemId = form.dataset.itemId;
    const card = form.closest(".item-card");
    const answers = Array.from(card.querySelectorAll("[data-question-id]")).map((input) => ({
        question_id: Number(input.dataset.questionId),
        answer_text: input.value.trim(),
    }));

    const payload = Object.fromEntries(new FormData(form).entries());
    payload.answers = answers;

    const data = await apiRequest(`/api/found-items/${itemId}/claims`, {
        method: "POST",
        body: JSON.stringify(payload),
    });

    form.reset();
    card.querySelectorAll("[data-question-id]").forEach((input) => {
        input.value = "";
    });
    await refreshDashboard();
    state.latestClaimStatus = {
        claim_id: data.claim_id,
        item_name: card.querySelector("h4").textContent,
        status: data.claim_status,
        message: `Claim submitted successfully. Your Claim ID is ${data.claim_id}. Save it to track the result later.`,
    };
    renderClaimStatus();
    window.alert(`Verification claim submitted. Your Claim ID is ${data.claim_id}.`);
}

async function unlockFinderVault(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

    const data = await apiRequest(`/api/found-items/${payload.found_item_id}/finder-access`, {
        method: "POST",
        body: JSON.stringify({ access_key: payload.access_key }),
    });

    state.finderVault = data.item;
    renderFinderVault();
}

async function updateFoundStatus(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

    const data = await apiRequest(`/api/found-items/${payload.item_id}/status`, {
        method: "POST",
        body: JSON.stringify({
            access_key: payload.access_key,
            status: payload.status,
        }),
    });

    state.finderVault = data.item;
    await refreshDashboard();
}

async function reviewClaimDecision(event) {
    const button = event.currentTarget;
    const claimId = Number(button.dataset.claimId);
    const decision = button.dataset.decision;
    const form = document.getElementById("finderAccessForm");
    const foundItemId = Number(form.querySelector('[name="found_item_id"]').value);
    const accessKey = form.querySelector('[name="access_key"]').value.trim();

    if (!foundItemId || !accessKey) {
        window.alert("Unlock the finder vault first.");
        return;
    }

    const data = await apiRequest(`/api/found-items/${foundItemId}/claims/${claimId}/decision`, {
        method: "POST",
        body: JSON.stringify({
            access_key: accessKey,
            decision,
        }),
    });

    state.finderVault = data.item;
    await refreshDashboard();
}

async function checkClaimStatus(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

    const data = await apiRequest("/api/claims/status", {
        method: "POST",
        body: JSON.stringify(payload),
    });

    state.latestClaimStatus = data.claim;
    renderClaimStatus();
}

async function refreshClaimStatusSilently() {
    const form = document.getElementById("claimStatusForm");
    if (!form || !state.latestClaimStatus || state.latestClaimStatus.status !== "Pending Review") {
        return;
    }

    const payload = Object.fromEntries(new FormData(form).entries());
    if (!payload.claim_id || !payload.claimant_contact) {
        return;
    }

    try {
        const data = await apiRequest("/api/claims/status", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        state.latestClaimStatus = data.claim;
        renderClaimStatus();
    } catch (error) {
        console.error(error);
    }
}

function initializeQuestions() {
    createQuestionRow("What color is the item?");
    createQuestionRow("What unique mark or sticker does it have?");
    createQuestionRow("Where do you usually keep or use it?");
}

tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

document.getElementById("addQuestionButton").addEventListener("click", () => {
    createQuestionRow("", "");
});

document.getElementById("lostForm").addEventListener("submit", submitLostItem);
document.getElementById("foundForm").addEventListener("submit", submitFoundItem);
document.getElementById("finderAccessForm").addEventListener("submit", unlockFinderVault);
document.getElementById("claimStatusForm").addEventListener("submit", checkClaimStatus);

initializeQuestions();
connectLiveUpdates();
refreshDashboard().catch((error) => {
    console.error(error);
    window.alert("Unable to load portal data. Start the Python backend and refresh the page.");
});

window.setInterval(() => {
    if (!state.liveUpdatesConnected) {
        refreshDashboard().catch((error) => {
            console.error(error);
        });
    }
    refreshClaimStatusSilently();
    refreshFinderVaultSilently();
}, REFRESH_INTERVAL_MS);
