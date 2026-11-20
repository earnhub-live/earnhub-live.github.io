
"use strict";

// ==========================================
// EARNHUB SPONSOR DASHBOARD - COMPLETE JS
// ==========================================

const db = window.supabaseClient;
const BUCKET = "deposit-screenshots";

const $ = id => document.getElementById(id);

let currentUser = null;
let sponsorAccount = null;
let campaigns = [];
let dashboardLoading = false;

// ==========================================
// HELPERS
// ==========================================

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
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function setButtonLoading(button, loading, normalText) {
    if (!button) return;

    button.disabled = loading;
    button.textContent = loading ? "Please wait..." : normalText;
}

function setFormDisabled(formId, disabled) {
    const form = $(formId);
    if (!form) return;

    form.querySelectorAll("input, textarea, select, button")
        .forEach(element => {
            element.disabled = disabled;
        });
}

// ==========================================
// AUTHENTICATION
// ==========================================

async function getSession() {
    if (!db) {
        message("Supabase client not found. Check supabase.js.", true);
        return false;
    }

    try {
        const { data, error } = await db.auth.getUser();

        if (error || !data?.user) {
            currentUser = null;
            message("Please login to access the sponsor dashboard.", true);
            return false;
        }

        currentUser = data.user;
        return true;

    } catch (error) {
        currentUser = null;
        message("Login check failed: " + error.message, true);
        return false;
    }
}

// ==========================================
// SPONSOR ACCOUNT
// ==========================================

async function loadSponsorAccount() {
    if (!currentUser) return false;

    try {
        const { data, error } = await db
            .from("sponsor_accounts")
            .select("*")
            .eq("id", currentUser.id)
            .maybeSingle();

        if (error) {
            message("Sponsor account error: " + error.message, true);
            return false;
        }

        sponsorAccount = data;

        if (!sponsorAccount) {
            $("sponsorName").textContent = "Not registered";

            message(
                "Please register your sponsor account first."
            );

            setFormDisabled("campaignForm", true);
            setFormDisabled("paymentForm", true);

            return false;
        }

        $("sponsorName").textContent =
            sponsorAccount.company_name || "Sponsor Account";

        if (sponsorAccount.status !== "approved") {
            message(
                "Your sponsor account is " +
                sponsorAccount.status +
                ". Please wait for admin approval."
            );

            setFormDisabled("campaignForm", true);
            setFormDisabled("paymentForm", true);

            return false;
        }

        setFormDisabled("campaignForm", false);
        setFormDisabled("paymentForm", false);

        return true;

    } catch (error) {
        message("Account loading failed: " + error.message, true);
        return false;
    }
}

// ==========================================
// SPONSOR REGISTRATION
// ==========================================

async function registerSponsor(event) {
    event.preventDefault();

    if (!await getSession()) {
        message("Please login first.", true);
        return;
    }

    const form = $("sponsorRegisterForm");
    const button = form?.querySelector('button[type="submit"]');

    const company = $("companyName").value.trim();
    const contactName = $("contactName").value.trim();
    const email = $("sponsorEmail").value.trim();
    const phone = $("sponsorPhone").value.trim();

    if (!company || !contactName || !email || !phone) {
        message("Please fill all registration fields.", true);
        return;
    }

    setButtonLoading(button, true, "Register Sponsor Account");

    try {
        // Check whether account already exists.
        const { data: existing, error: checkError } = await db
            .from("sponsor_accounts")
            .select("id")
            .eq("id", currentUser.id)
            .maybeSingle();

        if (checkError) {
            throw checkError;
        }

        if (existing) {
            message("Sponsor account is already registered.", true);
            await loadDashboard();
            return;
        }

        const { error } = await db
            .from("sponsor_accounts")
            .insert({
                id: currentUser.id,
                company_name: company,
                contact_name: contactName,
                contact_email: email,
                contact_phone: phone,
                status: "pending"
            });

        if (error) throw error;

        form.reset();

        message(
            "Registration submitted successfully. Wait for admin approval."
        );

        await loadDashboard();

    } catch (error) {
        message("Registration failed: " + error.message, true);

    } finally {
        setButtonLoading(button, false, "Register Sponsor Account");
    }
}

// ==========================================
// CAMPAIGN BUDGET
// ==========================================

function calculateBudget() {
    const reward = Number($("campaignReward")?.value || 0);
    const slots = Number($("campaignSlots")?.value || 0);

    const taskBudget = reward > 0 && slots > 0
        ? Math.round(reward * slots * 100) / 100
        : 0;

    const sponsorAmount = taskBudget > 0
        ? Math.round((taskBudget / 0.70) * 100) / 100
        : 0;

    const companyAmount = Math.round(
        (sponsorAmount - taskBudget) * 100
    ) / 100;

    if ($("sponsorAmount")) {
        $("sponsorAmount").textContent = money(sponsorAmount);
    }

    if ($("taskAllocation")) {
        $("taskAllocation").textContent = money(taskBudget);
    }

    if ($("companyAllocation")) {
        $("companyAllocation").textContent = money(companyAmount);
    }

    return {
        taskBudget,
        sponsorAmount,
        companyAmount
    };
}

// ==========================================
// CREATE CAMPAIGN
// ==========================================

async function createCampaign(event) {
    event.preventDefault();

    if (!currentUser || !sponsorAccount ||
        sponsorAccount.status !== "approved") {
        message("Approved sponsor account required.", true);
        return;
    }

    const form = $("campaignForm");
    const button = form?.querySelector('button[type="submit"]');

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

    setButtonLoading(button, true, "Create Campaign");

    try {
        const { data, error } = await db
            .from("tasks")
            .insert(campaignData)
            .select("id")
            .single();

        if (error) throw error;

        form.reset();
        calculateBudget();

        message(
            "Campaign created. Select it below and submit your payment."
        );

        await loadCampaigns();
        await loadStats();

    } catch (error) {
        message("Campaign creation failed: " + error.message, true);

    } finally {
        setButtonLoading(button, false, "Create Campaign");
    }
}

// ==========================================
// LOAD CAMPAIGNS
// ==========================================

async function loadCampaigns() {
    if (!currentUser) return;

    const tbody = $("campaignList");
    const selector = $("paymentCampaign");

    if (tbody) {
        tbody.innerHTML =
            '<tr><td colspan="5">Loading campaigns...</td></tr>';
    }

    if (selector) {
        selector.innerHTML =
            '<option value="">Loading campaigns...</option>';
    }

    try {
        const { data, error } = await db
            .from("tasks")
            .select(
                "id,title,reward,total_slots,remaining_slots," +
                "campaign_budget,budget_remaining,is_active," +
                "payment_verified,sponsor_payment_amount"
            )
            .eq("sponsor_id", currentUser.id)
            .eq("task_type", "sponsored")
            .order("created_at", { ascending: false });

        if (error) throw error;

        campaigns = data || [];

        tbody.innerHTML = "";
        selector.innerHTML =
            '<option value="">Select Campaign</option>';

        if (!campaigns.length) {
            tbody.innerHTML =
                '<tr><td colspan="5">No campaigns found. Create a campaign first.</td></tr>';

            selector.innerHTML =
                '<option value="">No unpaid campaigns available</option>';

            message(
                "No campaigns are linked to your sponsor account. Existing unlinked campaigns need admin/database linking.",
                true
            );

            return;
        }

        let unpaidCount = 0;

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
                unpaidCount++;

                const option = document.createElement("option");
                option.value = campaign.id;
                option.textContent = campaign.title;

                selector.appendChild(option);
            }
        });

        if (unpaidCount === 0) {
            selector.innerHTML =
                '<option value="">No unpaid campaigns available</option>';
        }

    } catch (error) {
        campaigns = [];

        tbody.innerHTML =
            '<tr><td colspan="5">Unable to load campaigns.</td></tr>';

        selector.innerHTML =
            '<option value="">Campaign loading failed</option>';

        message("Campaign loading failed: " + error.message, true);
    }
}

// ==========================================
// PAYMENT CAMPAIGN SELECTION
// ==========================================

function handleCampaignSelection() {
    const taskId = $("paymentCampaign").value;

    const campaign = campaigns.find(item => item.id === taskId);

    $("paymentAmount").value = campaign
        ? Number(campaign.sponsor_payment_amount).toFixed(2)
        : "";
}

// ==========================================
// SUBMIT PAYMENT
// ==========================================

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

    const campaign = campaigns.find(item => item.id === taskId);

    if (!taskId || !campaign) {
        message("Please select an available campaign first.", true);
        return;
    }

    if (!["JazzCash Merchant", "UPaisa"].includes(method)) {
        message("Please select JazzCash Merchant or UPaisa.", true);
        return;
    }

    if (!file || !transactionId) {
        message("Enter transaction ID and upload payment screenshot.", true);
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

    const form = $("paymentForm");
    const button = form?.querySelector('button[type="submit"]');

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

    const filePath =
        currentUser.id + "/" +
        taskId + "/" +
        Date.now() + "_" + safeName;

    setButtonLoading(button, true, "Submit Payment");

    let uploadedPath = null;

    try {
        message("Uploading payment screenshot...");

        const { error: uploadError } = await db.storage
            .from(BUCKET)
            .upload(filePath, file, {
                contentType: file.type,
                upsert: false
            });

        if (uploadError) throw uploadError;

        uploadedPath = filePath;

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

        if (error) throw error;

        form.reset();

        message(
            "Payment submitted successfully. Await admin verification."
        );

        await loadPayments();
        await loadStats();

    } catch (error) {
        message("Payment submission failed: " + error.message, true);

        // Remove uploaded screenshot if database insert failed.
        if (uploadedPath) {
            await db.storage
                .from(BUCKET)
                .remove([uploadedPath]);
        }

    } finally {
        setButtonLoading(button, false, "Submit Payment");
    }
}

// ==========================================
// LOAD PAYMENT HISTORY
// ==========================================

async function loadPayments() {
    if (!currentUser) return;

    const tbody = $("paymentHistory");

    try {
        const { data, error } = await db
            .from("sponsor_payments")
            .select(
                "transaction_id,payment_method,payment_amount," +
                "payment_status,submitted_at"
            )
            .eq("sponsor_id", currentUser.id)
            .order("submitted_at", { ascending: false });

        if (error) throw error;

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

    } catch (error) {
        tbody.innerHTML =
            '<tr><td colspan="5">Unable to load payment history.</td></tr>';

        message("Payment history error: " + error.message, true);
    }
}

// ==========================================
// DASHBOARD STATISTICS
// ==========================================

async function loadStats() {
    if (!currentUser) return;

    $("totalCampaigns").textContent = campaigns.length;

    $("activeCampaigns").textContent =
        campaigns.filter(item => item.is_active).length;

    try {
        const { data, error } = await db
            .from("sponsor_payments")
            .select("payment_amount,payment_status")
            .eq("sponsor_id", currentUser.id);

        if (error) throw error;

        const payments = data || [];

        $("pendingPayments").textContent =
            payments.filter(
                item => item.payment_status === "pending"
            ).length;

        $("totalInvestment").textContent = money(
            payments
                .filter(item => item.payment_status === "verified")
                .reduce(
                    (sum, item) => sum + Number(item.payment_amount),
                    0
                )
        );

    } catch (error) {
        message("Statistics loading failed: " + error.message, true);
    }
}

// ==========================================
// LOGOUT
// ==========================================

async function logoutSponsor() {
    const button = $("logoutBtn");

    if (button) {
        button.disabled = true;
        button.textContent = "Logging out...";
    }

    try {
        if (db) {
            const { error } = await db.auth.signOut({
                scope: "local"
            });

            if (error) {
                console.error("Logout error:", error);
            }
        }

    } catch (error) {
        console.error("Logout exception:", error);

    } finally {
        // Always leave dashboard after logout attempt.
        window.location.replace("login.html");
    }
}

// ==========================================
// LOAD DASHBOARD
// ==========================================

async function loadDashboard() {
    if (dashboardLoading) return;

    dashboardLoading = true;

    try {
        if (!await getSession()) {
            return;
        }

        const approved = await loadSponsorAccount();

        if (!sponsorAccount || !approved) {
            return;
        }

        await loadCampaigns();
        await loadPayments();
        await loadStats();

    } finally {
        dashboardLoading = false;
    }
}

// ==========================================
// AUTH STATE LISTENER
// ==========================================

function setupAuthListener() {
    if (!db) return;

    db.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT" || !session) {
            currentUser = null;
            sponsorAccount = null;
            campaigns = [];
        }
    });
}

// ==========================================
// EVENT LISTENERS
// ==========================================

function initializeSponsorDashboard() {
    if (!db) {
        message("Supabase client not found. Check supabase.js.", true);
        return;
    }

    $("sponsorRegisterForm")?.addEventListener(
        "submit",
        registerSponsor
    );

    $("campaignForm")?.addEventListener(
        "submit",
        createCampaign
    );

    $("paymentForm")?.addEventListener(
        "submit",
        submitPayment
    );

    $("logoutBtn")?.addEventListener(
        "click",
        logoutSponsor
    );

    $("paymentCampaign")?.addEventListener(
        "change",
        handleCampaignSelection
    );

    $("campaignReward")?.addEventListener(
        "input",
        calculateBudget
    );

    $("campaignSlots")?.addEventListener(
        "input",
        calculateBudget
    );

    setupAuthListener();

    calculateBudget();
    loadDashboard();
}

// ==========================================
// START
// ==========================================

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeSponsorDashboard
    );
} else {
    initializeSponsorDashboard();
}
