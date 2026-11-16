
const db = window.supabaseClient;

const BUCKET = "deposit-screenshots";
const $ = (id) => document.getElementById(id);

let currentUser = null;
let sponsorAccount = null;
let campaigns = [];

function message(text, error = false) {
    const el = $("sponsorMessage");
    if (!el) return;
    el.textContent = text;
    el.style.color = error ? "#dc2626" : "#15803d";
}

function money(value) {
    return "Rs. " + Number(value || 0).toFixed(2);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[c]);
}

async function getSession() {
    const { data, error } = await db.auth.getUser();

    if (error || !data.user) {
        currentUser = null;
        message("Please login before accessing the sponsor dashboard.", true);
        return false;
    }

    currentUser = data.user;
    return true;
}

async function loadSponsorAccount() {
    const { data, error } = await db
        .from("sponsor_accounts")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

    if (error) {
        message(error.message, true);
        return false;
    }

    sponsorAccount = data;

    if (!sponsorAccount) {
        $("sponsorName").textContent = "Not registered";
        return false;
    }

    $("sponsorName").textContent = sponsorAccount.company_name;

    if (sponsorAccount.status !== "approved") {
        message(
            "Your sponsor account is " +
            sponsorAccount.status +
            ". Please wait for admin approval.",
            true
        );
        return false;
    }

    return true;
}

// SPONSOR REGISTRATION

async function registerSponsor(event) {
    event.preventDefault();

    if (!await getSession()) return;

    const company = $("companyName").value.trim();
    const email = $("sponsorEmail").value.trim();

    if (!company || !email) {
        message("Company name and email are required.", true);
        return;
    }

    const { error } = await db
        .from("sponsor_accounts")
        .insert({
            id: currentUser.id,
            company_name: company,
            contact_email: email,
            status: "pending"
        });

    if (error) {
        message(error.message, true);
        return;
    }

    $("sponsorRegisterForm").reset();

    message("Sponsor registration submitted. Await admin approval.");

    await loadDashboard();
}

// CAMPAIGN BUDGET CALCULATION

function calculateBudget() {
    const reward = Number($("campaignReward").value);
    const slots = Number($("campaignSlots").value);

    const taskBudget = reward > 0 && slots > 0
        ? Math.round(reward * slots * 100) / 100
        : 0;

    const sponsorAmount = taskBudget > 0
        ? Math.round(taskBudget / 0.70 * 100) / 100
        : 0;

    const companyAmount = Math.round(
        (sponsorAmount - taskBudget) * 100
    ) / 100;

    $("sponsorAmount").textContent = money(sponsorAmount);
    $("taskAllocation").textContent = money(taskBudget);
    $("companyAllocation").textContent = money(companyAmount);

    return {
        taskBudget,
        sponsorAmount,
        companyAmount
    };
}

// CREATE SPONSORED CAMPAIGN

async function createCampaign(event) {
    event.preventDefault();

    if (!currentUser || !sponsorAccount ||
        sponsorAccount.status !== "approved") {
        message("Approved sponsor account required.", true);
        return;
    }

    const title = $("campaignTitle").value.trim();
    const description = $("campaignDescription").value.trim();
    const reward = Number($("campaignReward").value);
    const slots = Number($("campaignSlots").value);

    const start = new Date($("campaignStart").value);
    const end = new Date($("campaignEnd").value);

    if (!title || !description || reward <= 0 ||
        !Number.isInteger(slots) || slots <= 0) {
        message("Please enter valid campaign details.", true);
        return;
    }

    if (isNaN(start.getTime()) || isNaN(end.getTime()) ||
        start <= new Date() || end <= start) {
        message("Please select valid future campaign dates.", true);
        return;
    }

    const budget = calculateBudget();

    if (budget.taskBudget <= 0 || budget.sponsorAmount <= 0) {
        message("Invalid campaign budget.", true);
        return;
    }

    const campaignData = {
        title,
        description,
        reward,
        task_type: "sponsored",
        sponsor_company: sponsorAccount.company_name,
        sponsor_id: currentUser.id,

        campaign_budget: budget.taskBudget,
        budget_remaining: budget.taskBudget,

        total_slots: slots,
        remaining_slots: slots,

        sponsor_payment_amount: budget.sponsorAmount,
        company_revenue_amount: budget.companyAmount,

        payment_verified: false,
        is_active: false,

        campaign_start_at: start.toISOString(),
        campaign_end_at: end.toISOString(),

        verification_method: "manual"
    };

    const { error } = await db
        .from("tasks")
        .insert(campaignData);

    if (error) {
        message(error.message, true);
        return;
    }

    $("campaignForm").reset();
    calculateBudget();

    message("Campaign created successfully. Submit payment for admin verification.");

    await loadCampaigns();
    await loadStats();
}

// LOAD CAMPAIGNS

async function loadCampaigns() {
    if (!currentUser) return;

    const { data, error } = await db
        .from("tasks")
        .select("id,title,reward,total_slots,remaining_slots,campaign_budget,budget_remaining,is_active,payment_verified,sponsor_payment_amount")
        .eq("sponsor_id", currentUser.id)
        .eq("task_type", "sponsored")
        .order("created_at", { ascending: false });

    if (error) {
        message(error.message, true);
        return;
    }

    campaigns = data || [];

    const tbody = $("campaignList");
    const selector = $("paymentCampaign");

    tbody.innerHTML = "";
    selector.innerHTML = '<option value="">Select Campaign</option>';

    if (!campaigns.length) {
        tbody.innerHTML =
            '<tr><td colspan="5">No campaigns found.</td></tr>';
        return;
    }

    campaigns.forEach(campaign => {
        const status = campaign.is_active
            ? "Active"
            : campaign.payment_verified
                ? "Verified"
                : "Pending Payment";

        tbody.innerHTML += `
            <tr>
                <td>${escapeHTML(campaign.title)}</td>
                <td>${money(campaign.reward)}</td>
                <td>${campaign.remaining_slots}/${campaign.total_slots}</td>
                <td>${money(campaign.campaign_budget)}</td>
                <td>${status}</td>
            </tr>
        `;

        if (!campaign.payment_verified) {
            selector.innerHTML += `
                <option value="${campaign.id}">
                    ${escapeHTML(campaign.title)}
                </option>
            `;
        }
    });
}

// AUTO-FILL PAYMENT AMOUNT

$("paymentCampaign").addEventListener("change", function () {
    const campaign = campaigns.find(c => c.id === this.value);

    $("paymentAmount").value = campaign
        ? Number(campaign.sponsor_payment_amount).toFixed(2)
        : "";
});

// SUBMIT SPONSOR PAYMENT

async function submitPayment(event) {
    event.preventDefault();

    if (!currentUser || !sponsorAccount ||
        sponsorAccount.status !== "approved") {
        message("Approved sponsor account required.", true);
        return;
    }

    const taskId = $("paymentCampaign").value;
    const method = $("paymentMethod").value;
    const amount = Number($("paymentAmount").value);
    const transactionId = $("transactionId").value.trim();
    const file = $("paymentScreenshot").files[0];

    const campaign = campaigns.find(c => c.id === taskId);

    if (!campaign || !file || !transactionId || !method) {
        message("Complete all payment details.", true);
        return;
    }

    if (amount !== Number(campaign.sponsor_payment_amount)) {
        message("Payment amount does not match campaign amount.", true);
        return;
    }

    if (!file.type.startsWith("image/") ||
        file.size > 5 * 1024 * 1024) {
        message("Upload an image smaller than 5 MB.", true);
        return;
    }

    const filePath =
        currentUser.id + "/" +
        taskId + "/" +
        Date.now() + "_" +
        file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

    message("Uploading payment screenshot...");

    const { error: uploadError } = await db.storage
        .from(BUCKET)
        .upload(filePath, file, {
            contentType: file.type,
            upsert: false
        });

    if (uploadError) {
        message("Screenshot upload failed: " + uploadError.message, true);
        return;
    }

    const { error } = await db
        .from("sponsor_payments")
        .insert({
            task_id: taskId,
            sponsor_id: currentUser.id,
            sponsor_company: sponsorAccount.company_name,
            payment_method: method,
            payment_amount: amount,
            transaction_id: transactionId,
            payment_status: "pending",
            screenshot_url: filePath
        });

    if (error) {
        message("Payment submission failed: " + error.message, true);
        return;
    }

    $("paymentForm").reset();

    message("Payment submitted successfully. Await admin verification.");

    await loadPayments();
}

// LOAD PAYMENT HISTORY

async function loadPayments() {
    if (!currentUser) return;

    const { data, error } = await db
        .from("sponsor_payments")
        .select("transaction_id,payment_method,payment_amount,payment_status,submitted_at")
        .eq("sponsor_id", currentUser.id)
        .order("submitted_at", { ascending: false });

    if (error) {
        message(error.message, true);
        return;
    }

    const tbody = $("paymentHistory");
    tbody.innerHTML = "";

    if (!data || !data.length) {
        tbody.innerHTML =
            '<tr><td colspan="5">No payment history found.</td></tr>';
        return;
    }

    data.forEach(payment => {
        tbody.innerHTML += `
            <tr>
                <td>${escapeHTML(payment.transaction_id)}</td>
                <td>${escapeHTML(payment.payment_method)}</td>
                <td>${money(payment.payment_amount)}</td>
                <td>${escapeHTML(payment.payment_status)}</td>
                <td>${payment.submitted_at
                    ? new Date(payment.submitted_at).toLocaleDateString()
                    : "-"}</td>
            </tr>
        `;
    });
}

// DASHBOARD STATISTICS

async function loadStats() {
    $("totalCampaigns").textContent = campaigns.length;

    $("activeCampaigns").textContent =
        campaigns.filter(c => c.is_active).length;

    const { data, error } = await db
        .from("sponsor_payments")
        .select("payment_amount,payment_status")
        .eq("sponsor_id", currentUser.id);

    if (error) {
        message(error.message, true);
        return;
    }

    const payments = data || [];

    $("pendingPayments").textContent =
        payments.filter(p => p.payment_status === "pending").length;

    $("totalInvestment").textContent = money(
        payments
            .filter(p => p.payment_status === "verified")
            .reduce((sum, p) => sum + Number(p.payment_amount), 0)
    );
}

// LOGOUT

async function logoutSponsor() {
    const { error } = await db.auth.signOut();

    if (error) {
        message(error.message, true);
        return;
    }

    window.location.href = "login.html";
}

// INITIALIZE DASHBOARD

async function loadDashboard() {
    if (!await getSession()) return;

    const approved = await loadSponsorAccount();

    if (!sponsorAccount) {
        return;
    }

    if (!approved) {
        return;
    }

    await loadCampaigns();
    await loadPayments();
    await loadStats();
}

// EVENT LISTENERS

$("sponsorRegisterForm").addEventListener(
    "submit", registerSponsor
);

$("campaignForm").addEventListener(
    "submit", createCampaign
);

$("paymentForm").addEventListener(
    "submit", submitPayment
);

$("logoutBtn").addEventListener(
    "click", logoutSponsor
);

$("campaignReward").addEventListener(
    "input", calculateBudget
);

$("campaignSlots").addEventListener(
    "input", calculateBudget
);

// START

if (!db) {
    message("Supabase client not found. Check supabase.js.", true);
} else {
    calculateBudget();
    loadDashboard();
}
