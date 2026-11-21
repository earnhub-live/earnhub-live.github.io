
/* =================================================
   EARNHUB - COMPLETE FIXED JAVASCRIPT
   Requires existing supabase.js
================================================= */

const db = window.supabaseClient;

let currentUser = null;
let isAdmin = false;
let authMode = "signup";


// =================================================
// 1. HELPERS
// =================================================

function el(id) {
    return document.getElementById(id);
}

function setText(id, value) {
    const element = el(id);
    if (element) element.textContent = value;
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}
function money(value) {
    return "₨" + Number(value || 0).toLocaleString("en-PK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}
function notify(message) {
    alert(message);
}


// =================================================
// 2. MODALS
// =================================================
function showSignup() {
    authMode = "signup";

    el("authModal")?.classList.remove("hidden");

    setText("modalTitle", "Create Account");
    setText("authSubmit", "Sign Up");
    setText("authMessage", "");

    ["usernameGroup", "nameGroup", "confirmPasswordGroup"].forEach(id => {
        const field = el(id);
        if (field) {
            field.classList.remove("hidden");
            field.style.display = "";
        }
    });

    el("forgotPasswordGroup")?.classList.add("hidden");

    el("authUsername").required = true;
    el("authName").required = true;
    el("authEmail").required = true;
    el("authPassword").required = true;
    el("authConfirmPassword").required = true;

    el("authPassword").autocomplete = "new-password";

    el("authSwitch").innerHTML =
        'Already have an account? <a href="#" onclick="showLogin(); return false;">Login</a>';
}
function showLogin() {
    authMode = "login";

    el("authModal")?.classList.remove("hidden");

    setText("modalTitle", "Welcome Back");
    setText("authSubmit", "Login");
    setText("authMessage", "");

    ["usernameGroup", "nameGroup", "confirmPasswordGroup"].forEach(id => {
        const field = el(id);
        if (field) {
            field.classList.add("hidden");
            field.style.display = "none";
        }
    });

    el("forgotPasswordGroup")?.classList.remove("hidden");

    el("authEmail").required = true;
    el("authPassword").required = true;
    el("authPassword").autocomplete = "current-password";

    el("authUsername").required = false;
    el("authName").required = false;
    el("authConfirmPassword").required = false;

    el("authSwitch").innerHTML =
        'New to EarnHub? <a href="#" onclick="showSignup(); return false;">Create Account</a>';
}

// =================================================
// 3. AUTHENTICATION
// =================================================

async function handleAuthSubmit(event) {
    event.preventDefault();

    if (!db) {
        notify("Supabase is not connected. Check supabase.js.");
        return;
    }

    const username = el("authUsername")?.value.trim() || "";
    const name = el("authName")?.value.trim() || "";
    const email = el("authEmail")?.value.trim() || "";
    const password = el("authPassword")?.value || "";
    const confirmPassword = el("authConfirmPassword")?.value || "";

    const message = el("authMessage");
    const button = el("authSubmit");

    if (!email) {
        if (message) message.textContent = "Enter your email.";
        return;
    }

    if (!password) {
        if (message) message.textContent = "Enter your password.";
        return;
    }

    if (authMode === "signup") {
        if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
            if (message) message.textContent = "Username must be 3-20 letters, numbers or underscores.";
            return;
        }

        if (!name) {
            if (message) message.textContent = "Enter your full name.";
            return;
        }

        if (password.length < 6) {
            if (message) message.textContent = "Password must be at least 6 characters.";
            return;
        }

        if (password !== confirmPassword) {
            if (message) message.textContent = "Passwords do not match.";
            return;
        }
    }

    if (button) button.disabled = true;
    if (message) message.textContent = "Please wait...";

    try {
        if (authMode === "signup") {
            const { data, error } = await db.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username,
                        full_name: name,
                        referral_code: el("referralCode")?.value.trim() || null
                    }
                }
            });

            if (error) throw error;

            if (data.session && data.user) {
                closeModal();
                notify("Account created successfully!");
                await loadDashboard(data.user);
            } else {
                if (message) {
                    message.textContent =
                        "Verification email sent! Please verify your email before logging in.";
                }
            }

        } else if (authMode === "login") {
            const { data, error } = await db.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            if (!data.user.email_confirmed_at) {
                if (message) {
                    message.textContent = "Please verify your email before logging in.";
                }
                return;
            }

            closeModal();
            await loadDashboard(data.user);
        }

    } catch (error) {
        console.error("Authentication error:", error);

        if (message) {
            if (
                error.message?.toLowerCase().includes("duplicate key") ||
                error.message?.toLowerCase().includes("unique constraint") ||
                error.message?.toLowerCase().includes("username")
            ) {
                message.textContent = "Username already taken. Choose another.";
            } else {
                message.textContent = error.message;
            }
        }

    } finally {
        if (button) button.disabled = false;
    }
}


// =================================================
// 4. NAVIGATION
// =================================================

function updateAuthButtons(user) {
    const nav = el("navButtons");
    if (!nav) return;

    const whatsappButton = `
        <a href="https://whatsapp.com/channel/0029Vb97phE3WHTRktFWCb41"
           target="_blank"
           rel="noopener noreferrer"
           class="whatsapp-nav-btn">
            <span>☘</span> WhatsApp
        </a>
    `;

    if (user) {
        const name =
            user.user_metadata?.full_name ||
            user.email ||
            "User";

        nav.innerHTML = `
            <button onclick="showHome()">Home</button>
            <button onclick="goTo('about')">About</button>
            <button onclick="goTo('publicTasks')">Tasks</button>

            ${whatsappButton}

            <span>Hi, ${escapeHTML(name)}</span>

            <button onclick="openDashboard()">Dashboard</button>

            <!-- NAVBAR NOTIFICATION BELL -->
            <div class="notification-wrapper">

                <button
                    class="notification-bell"
                    type="button"
                    aria-label="Notifications"
                    onclick="toggleNotifications()">

                    🔔
                    <span id="notificationCount">0</span>

                </button>

                <section
                    id="notificationDropdown"
                    class="panel notification-panel"
                    hidden>

                    <div class="panel-heading">
                        <div>
                            <span class="eyebrow">ACCOUNT UPDATES</span>
                            <h2>Notifications</h2>
                        </div>
                    </div>

                    <div id="notificationList">
                        Loading notifications...
                    </div>

                </section>
            </div>

            <button onclick="logout()">Logout</button>
        `;
    } else {
        nav.innerHTML = `
            <button onclick="showHome()">Home</button>
            <button onclick="goTo('about')">About</button>
            <button onclick="goTo('publicTasks')">Tasks</button>

            ${whatsappButton}

            <button onclick="showLogin()">Login</button>
            <button class="primary" onclick="showSignup()">Sign Up</button>
        `;
    }
}


function showHome() {
    el("dashboard")?.classList.add("hidden");
    el("home")?.classList.remove("hidden");
    el("features")?.classList.remove("hidden");

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


// =================================================
// 5. LOAD DASHBOARD
// =================================================

async function loadDashboard(user) {
    if (!db || !user) return;

    currentUser = user;

    setText(
        "sidebarUserName",
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "My Account"
    );

    setText("sidebarUserEmail", user.email || "");

    try {
        const { data: profile, error } = await db
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

        if (error) throw error;
// LOAD USER'S TOTAL APPROVED DEPOSITS
const { data: deposits, error: depositError } = await db
    .from("deposit_requests")
    .select("amount")
    .eq("user_id", user.id)
    .eq("status", "approved");

let totalDeposit = 0;

if (depositError) {
    console.error("Deposit loading error:", depositError);
} else {
    totalDeposit = (deposits || []).reduce(
        (total, item) => total + Number(item.amount || 0),
        0
    );
}

setText("totalDeposit", money(totalDeposit));
console.log("Deposit data:", deposits);
console.log("Deposit error:", depositError);
console.log("Deposit amounts:", deposits.map(item => item.amount));
console.log("Calculated total:", totalDeposit);
        setText(
            "welcomeUser",
            "Welcome, " + (profile.full_name || user.email)
        );

        setText("totalEarnings", money(profile.total_earnings));
        setText("availableBalance", money(profile.available_balance));
        setText("completedTasks", profile.completed_tasks || 0);
setText("walletBalance", money(profile.available_balance));

        setText(
            "walletEarnings",
            "Total Earnings: " + money(profile.total_earnings)
        );

        el("home")?.classList.add("hidden");
        el("features")?.classList.add("hidden");

        // Tasks panel stays inside the dashboard.
        // Do not hide it separately.

        el("dashboard")?.classList.remove("hidden");

        updateAuthButtons(user);
        await loadNotifications();
await loadEarningsProgress();
await loadReferralData();
        await checkAdmin();
await Promise.all([
    loadAdminWithdrawals(),
    loadAdminDeposits(),
    loadTasks(),
    loadMySubmissions(),
    loadTransactions(),
    loadPackageHistory(),
    loadCurrentActivePackage(),
    loadWithdrawalHistory(),
    loadDepositHistory()
]);
       

    } catch (error) {
        console.error("Dashboard error:", error);
        notify("Dashboard error: " + error.message);
    }
}


// =================================================
// 6. OPEN DASHBOARD
// =================================================

async function openDashboard() {
    if (!db) return;

    try {
        const { data, error } = await db.auth.getUser();

        if (error) throw error;

        if (!data.user) {
            showLogin();
            return;
        }

        await loadDashboard(data.user);

    } catch (error) {
        console.error("Open dashboard error:", error);
        notify(error.message);
    }
}


// =================================================
// 7. ADMIN CHECK
// =================================================

async function checkAdmin() {
    if (!db || !currentUser) return;

    const panel = el("adminPanel");

    try {
        const { data, error } = await db.rpc("is_admin");

        if (error) throw error;

        isAdmin = data === true;
const adminLink = document.getElementById("adminPanelLink");

adminLink?.classList.toggle("hidden", !isAdmin);
        panel?.classList.toggle("hidden", !isAdmin);
if (isAdmin) {
    await Promise.all([
        loadAdminSubmissions(),
        loadAdminAnalytics()
    ]);
}

    } catch (error) {
        console.error("Admin check:", error);

        isAdmin = false;
        panel?.classList.add("hidden");
    }
}


// =================================================
// 8. LOAD TASKS
// =================================================

async function loadTasks() {
    if (!db) return;

    const container = el("availableTaskList");
    if (!container) return;

    container.textContent = "Loading tasks...";

    try {
        const { data, error } = await db
            .from("tasks")
            .select("*")
           .eq("is_active", true)
.or("task_type.eq.normal,and(task_type.eq.sponsored,payment_verified.eq.true),and(task_type.eq.sponsored,sponsor_id.is.null,payment_verified.eq.false)")
.order("created_at", { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.textContent = "No tasks available right now.";
            return;
        }

        container.innerHTML = data.map(task => {
            const sponsored = task.task_type === "sponsored";

            return `
                <article class="card">

                    <span>
                        ${sponsored ? "⭐ SPONSORED TASK" : "NORMAL TASK"}
                    </span>

                    <h3>${escapeHTML(task.title)}</h3>

                    ${sponsored ? `
                        <p>Company: ${escapeHTML(task.sponsor_company || "Sponsor")}</p>
                    ` : ""}

                    <p>${escapeHTML(task.description || "")}</p>

                    <p>Reward: ${money(task.reward)}</p>

                    ${sponsored ? `
                        <p>Remaining Slots: ${task.remaining_slots ?? 0}</p>
                    ` : ""}

                    <button onclick="startTask('${escapeHTML(task.id)}')">
                        Start Task
                    </button>

                </article>
            `;
        }).join("");

    } catch (error) {
        console.error("Task loading error:", error);
        container.textContent =
            "Could not load tasks: " + error.message;
    }
}


// =================================================
// 9. START TASK AND SUBMIT PROOF
// =================================================

async function startTask(taskId) {
    if (!currentUser) {
        showLogin();
        return;
    }

    try {
        const { data: task, error } = await db
            .from("tasks")
            .select("*")
            .eq("id", taskId)
            .eq("is_active", true)
            .single();

        if (error) throw error;

        if (!window.earnHubOpenedTasks) {
            window.earnHubOpenedTasks = new Set();
        }

        if (!window.earnHubOpenedTasks.has(taskId)) {
            window.earnHubOpenedTasks.add(taskId);

            if (task.task_url) {
                window.open(task.task_url, "_blank");
            }

            notify(
                "Complete the task, return here and click Start Task again."
            );

            return;
        }

        // TASK PROOF INPUT MODAL
        const overlay = document.createElement("div");

        overlay.style.cssText = `
            position:fixed;
            inset:0;
            z-index:99999999;
            background:rgba(2,8,20,.88);
            display:flex;
            align-items:center;
            justify-content:center;
            padding:20px;
        `;

        overlay.innerHTML = `
            <div style="
                width:100%;
                max-width:450px;
                padding:26px;
                background:linear-gradient(145deg,#122945,#071426);
                border:1px solid #3185ff;
                border-radius:18px;
                box-shadow:0 15px 50px rgba(0,0,0,.55);
                color:white;
            ">
                <h3 style="color:white;margin-bottom:10px;">
                    Submit Task Proof
                </h3>

                <p style="color:#a8b8cc;margin-bottom:18px;">
                    Enter your task completion proof below.
                </p>

                <textarea
                    id="earnHubTaskProof"
                    placeholder="Write your task completion proof..."
                    style="
                        width:100%;
                        min-height:120px;
                        padding:13px;
                        color:white;
                        background:#091a2e;
                        border:1px solid #3185ff;
                        border-radius:10px;
                        resize:vertical;
                    "
                ></textarea>

                <div style="display:flex;gap:10px;margin-top:15px;">
                    <button id="cancelTaskProof"
                        type="button"
                        style="
                            flex:1;padding:12px;
                            background:#34445a;color:white;
                            border:0;border-radius:9px;
                        ">
                        Cancel
                    </button>

                    <button id="submitTaskProof"
                        type="button"
                        style="
                            flex:1;padding:12px;
                            background:#16a36a;color:white;
                            border:0;border-radius:9px;
                            font-weight:bold;
                        ">
                        Submit Proof
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const proof = await new Promise(resolve => {
            const input = overlay.querySelector("#earnHubTaskProof");

            overlay.querySelector("#cancelTaskProof").onclick = () => {
                overlay.remove();
                resolve(null);
            };

            overlay.querySelector("#submitTaskProof").onclick = () => {
                const value = input.value.trim();

                if (!value) {
                    notify("Proof is required.");
                    input.focus();
                    return;
                }

                overlay.remove();
                resolve(value);
            };

            input.focus();
        });

        if (!proof) return;

        const { error: submitError } = await db
            .from("task_submissions")
            .insert({
                user_id: currentUser.id,
                task_id: task.id,
                proof: proof,
                status: "pending"
            });

        if (submitError) {
            if (
                submitError.message?.includes(
                    "You can submit this task again after 24 hours."
                )
            ) {
                notify("You can submit this task again after 24 hours.");
                return;
            }

            throw submitError;
        }

        window.earnHubOpenedTasks.delete(taskId);

        notify(
            "Task submitted successfully! Waiting for admin approval."
        );

        await loadMySubmissions();

        if (isAdmin) {
            await loadAdminSubmissions();
        }

    } catch (error) {
        console.error("Submission error:", error);
        notify("Submission failed: " + error.message);
    }
}

// =================================================
// 10. WITHDRAWAL SYSTEM
// =================================================

async function submitWithdrawal() {
    if (!currentUser) {
        showLogin();
        return;
    }

    const amount = Number(el("withdrawAmount")?.value);
    const method = el("withdrawMethod")?.value;
    const accountName =
        el("withdrawAccountName")?.value.trim() || "";
    const accountNumber =
        el("withdrawAccountNumber")?.value.trim() || "";
if (!Number.isFinite(amount) || amount < 600) {
    notify("Minimum withdrawal amount is ₨600.");
    return;
}

   if (!["JazzCash", "Easypaisa", "Bank Transfer", "UPaisa", "NayaPay", "SadaPay"].includes(method)) {
        notify("Please select a valid withdrawal method.");
        return;
    }

    if (!accountName || !accountNumber) {
        notify("Please enter all withdrawal details.");
        return;
    }

    try {
        const { data: profile, error: profileError } = await db
            .from("profiles")
            .select("available_balance")
            .eq("id", currentUser.id)
            .single();

        if (profileError) throw profileError;

        const balance = Number(profile.available_balance || 0);

      if (balance < 600) {
    notify("You need at least ₨600 earned balance to withdraw.");
    return;
}

        if (amount > balance) {
            notify("Insufficient wallet balance.");
            return;
        }

        // CHECK LIFETIME APPROVED DEPOSITS
        const { data: deposits, error: depositError } = await db
            .from("deposit_requests")
            .select("amount")
            .eq("user_id", currentUser.id)
            .eq("status", "approved");

        if (depositError) throw depositError;

        const totalDeposits = (deposits || []).reduce(
            (sum, item) => sum + Number(item.amount || 0),
            0
        );
if (totalDeposits < 600) {
    notify("Please deposit at least ₨600 before withdrawing your balance.");
    return;
}

        const { data: pendingRequest, error: pendingError } = await db
            .from("withdrawal_requests")
            .select("id")
            .eq("user_id", currentUser.id)
            .eq("status", "pending")
            .maybeSingle();

        if (pendingError) throw pendingError;

        if (pendingRequest) {
            notify("You already have a pending withdrawal request.");
            return;
        }

        const { error: insertError } = await db
            .from("withdrawal_requests")
            .insert({
                user_id: currentUser.id,
                amount,
                method,
                account_name: accountName,
                account_number: accountNumber,
                status: "pending"
            });

        if (insertError) {
            if (insertError.code === "23505") {
                notify("You already have a pending withdrawal request.");
                return;
            }

            throw insertError;
        }

        notify("Withdrawal request submitted successfully!");

        if (el("withdrawAmount")) {
            el("withdrawAmount").value = "";
        }

        if (el("withdrawAccountName")) {
            el("withdrawAccountName").value = "";
        }

        if (el("withdrawAccountNumber")) {
            el("withdrawAccountNumber").value = "";
        }

        if (el("withdrawForm")) {
            el("withdrawForm").style.display = "none";
        }

        await loadWithdrawalHistory();

        if (isAdmin) {
            await loadAdminWithdrawals();
        }

    } catch (error) {
        console.error("Withdrawal error:", error);
        notify("Withdrawal failed: " + error.message);
    }
}

// =================================================
// 11. DEPOSIT SYSTEM
// =================================================

function showDepositForm() {
    if (!currentUser) {
        showLogin();
        return;
    }

    const form = el("depositForm");

    if (form) {
        form.style.display = "block";
        updateDepositPaymentDetails();
    }
}

function updateDepositPaymentDetails() {
    const method = el("depositMethod")?.value;

    const name = el("depositReceiverName");
    const number = el("depositReceiverNumber");

    if (!name || !number) return;

    if (method === "JazzCash Merchant") {
        name.textContent = "JazzCash Merchant";
        number.textContent = "PK03JCMA1211921438880689";
    } else if (method === "UPaisa") {
        name.textContent = "MUDASAR SHAHZAD";
        number.textContent = "03359190994";
    }
}

function showWithdrawForm() {
    if (!currentUser) {
        showLogin();
        return;
    }

    const form = el("withdrawForm");

    if (form) {
        form.style.display = "block";
    }
}

async function submitDeposit() {
    if (!currentUser) {
        showLogin();
        return;
    }

    const amount = Number(el("depositAmount")?.value);
    const method = el("depositMethod")?.value;

    const transactionId =
        el("depositTransactionId")?.value.trim() || "";

    const file = el("depositScreenshot")?.files?.[0];
if (!Number.isFinite(amount) || amount < 300) {
    notify("Minimum deposit amount is ₨300.");
    return;
}

    if (!["JazzCash Merchant", "UPaisa"].includes(method)) {
        notify("Please select a valid payment method.");
        return;
    }

    if (!transactionId) {
        notify("Please enter your Transaction ID.");
        return;
    }

    if (!file) {
        notify("Please upload your payment screenshot.");
        return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        notify("Only JPG, PNG and WEBP images are allowed.");
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        notify("Screenshot must be smaller than 5 MB.");
        return;
    }

    try {
        const { data: pending, error: pendingError } = await db
            .from("deposit_requests")
            .select("id")
            .eq("user_id", currentUser.id)
            .eq("status", "pending")
            .limit(1)
            .maybeSingle();

        if (pendingError) throw pendingError;

        if (pending) {
            notify("You already have a pending deposit request.");
            return;
        }

        const safeFileName = file.name.replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
        );

        const filePath =
            `${currentUser.id}/${Date.now()}_${safeFileName}`;

        const { error: uploadError } = await db.storage
            .from("deposit-screenshots")
            .upload(filePath, file, {
                contentType: file.type,
                upsert: false
            });

        if (uploadError) throw uploadError;

        const { error: insertError } = await db
            .from("deposit_requests")
            .insert({
                user_id: currentUser.id,
                amount,
                payment_method: method,
                transaction_id: transactionId,
                screenshot_url: filePath,
                status: "pending"
            });

        if (insertError) {
            await db.storage
                .from("deposit-screenshots")
                .remove([filePath]);

            throw insertError;
        }

        notify("Deposit request submitted successfully!");

        if (el("depositAmount")) {
            el("depositAmount").value = "";
        }

        if (el("depositTransactionId")) {
            el("depositTransactionId").value = "";
        }

        if (el("depositScreenshot")) {
            el("depositScreenshot").value = "";
        }

        if (el("depositForm")) {
            el("depositForm").style.display = "none";
        }

        await loadDepositHistory();

        if (isAdmin) {
            await loadAdminDeposits();
        }

    } catch (error) {
        console.error("Deposit error:", error);
        notify("Deposit failed: " + error.message);
    }
}


// =================================================
// 12. DEPOSIT HISTORY
// =================================================

async function loadDepositHistory() {
    if (!db || !currentUser) return;

    const container = el("depositHistory");
    if (!container) return;

    try {
        const { data, error } = await db
            .from("deposit_requests")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false });

        if (error) throw error;

        container.innerHTML = `
            <h3>Deposit History</h3>
            <div class="history-list" id="depositHistoryList"></div>
        `;

        const list = el("depositHistoryList");

        if (!data || data.length === 0) {
            list.innerHTML = `<div class="history-empty">No deposits yet.</div>`;
            return;
        }

        list.innerHTML = data.map(request => {
            const status = String(request.status || "pending")
                .toLowerCase()
                .replace(/[^a-z0-9_-]/g, "");

            return `
                <article class="history-record">
                    <div class="history-record-top">
                        <h3>Deposit: ${money(request.amount)}</h3>
                        <span class="history-status status-${status}">
                            ${escapeHTML(String(request.status || "Pending").toUpperCase())}
                        </span>
                    </div>

                    <div class="history-record-details">
                        <p>
                            <span>Payment Method</span>
                            <strong>${escapeHTML(request.payment_method || "N/A")}</strong>
                        </p>

                        <p>
                            <span>Transaction ID</span>
                            <strong>${escapeHTML(request.transaction_id || "N/A")}</strong>
                        </p>

                        <p>
                            <span>Requested</span>
                            <strong>${escapeHTML(request.created_at
                                ? new Date(request.created_at).toLocaleString()
                                : "N/A")}</strong>
                        </p>
                    </div>
                </article>
            `;
        }).join("");

    } catch (error) {
        console.error("Deposit history error:", error);
        container.textContent = "Could not load deposit history: " + error.message;
    }
}

// =================================================
// 13. WITHDRAWAL HISTORY
// =================================================

async function loadWithdrawalHistory() {
    if (!db || !currentUser) return;

    const container = el("withdrawalHistory");
    if (!container) return;

    try {
        const { data, error } = await db
            .from("withdrawal_requests")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false });

        if (error) throw error;

        container.innerHTML = `
            <h3>Withdrawal History</h3>
            <div class="history-list" id="withdrawalHistoryList"></div>
        `;

        const list = el("withdrawalHistoryList");

        if (!data || data.length === 0) {
            list.innerHTML = `
                <div class="history-empty">
                    No withdrawal requests yet.
                </div>
            `;
            return;
        }

        list.innerHTML = data.map(request => {
            const status = String(request.status || "pending")
                .toLowerCase()
                .replace(/[^a-z0-9_-]/g, "");

            return `
                <article class="history-record">
                    <div class="history-record-top">
                        <h3>Withdrawal: ${money(request.amount)}</h3>
                        <span class="history-status status-${status}">
                            ${escapeHTML(String(request.status || "Pending").toUpperCase())}
                        </span>
                    </div>

                    <div class="history-record-details">
                        <p>
                            <span>Payment Method</span>
                            <strong>${escapeHTML(request.method || "N/A")}</strong>
                        </p>

                        <p>
                            <span>Requested</span>
                            <strong>${escapeHTML(request.created_at
                                ? new Date(request.created_at).toLocaleString()
                                : "N/A")}</strong>
                        </p>

                        ${
                            request.transaction_id
                            ? `<p>
                                <span>Transaction ID</span>
                                <strong>${escapeHTML(request.transaction_id)}</strong>
                            </p>`
                            : ""
                        }

                        ${
                            request.paid_at
                            ? `<p>
                                <span>Paid Date</span>
                                <strong>${escapeHTML(new Date(request.paid_at).toLocaleString())}</strong>
                            </p>`
                            : ""
                        }
                    </div>
                </article>
            `;
        }).join("");

    } catch (error) {
        console.error("Withdrawal history error:", error);
        container.textContent =
            "Could not load withdrawal history: " + error.message;
    }
}


// =================================================
// 14. MY SUBMISSIONS
// =================================================

async function loadMySubmissions() {
    if (!db || !currentUser) return;

    const container = el("mySubmissions");
    if (!container) return;

    try {
        const { data, error } = await db
            .from("task_submissions")
            .select("id, status, proof, submitted_at, tasks(title, reward)")
            .eq("user_id", currentUser.id)
            .order("submitted_at", { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="history-empty">
                    No submissions yet.
                </div>
            `;
            return;
        }

        container.innerHTML = data.map(item => {
            const status = String(item.status || "pending")
                .toLowerCase()
                .replace(/[^a-z0-9_-]/g, "");

            return `
                <article class="history-record submission-record">
                    <div class="history-record-top">
                        <h3>${escapeHTML(item.tasks?.title || "Task")}</h3>
                        <span class="history-status status-${status}">
                            ${escapeHTML(item.status || "Pending")}
                        </span>
                    </div>

                    <div class="history-record-details">
                        <p>
                            <span>Reward</span>
                            <strong>${money(item.tasks?.reward)}</strong>
                        </p>

                        <p>
                            <span>Submitted</span>
                            <strong>
                                ${escapeHTML(item.submitted_at
                                    ? new Date(item.submitted_at).toLocaleString()
                                    : "N/A")}
                            </strong>
                        </p>
                    </div>

                    <div class="history-proof">
                        <span>Submission Proof</span>
                        <p>${escapeHTML(item.proof || "No proof provided")}</p>
                    </div>
                </article>
            `;
        }).join("");

    } catch (error) {
        console.error("Submissions error:", error);
        container.textContent = "Could not load submissions.";
    }
}


// =================================================
// 15. ADMIN - CREATE TASK
// =================================================

async function handleCreateTask(event) {
    event.preventDefault();

    if (!currentUser || !isAdmin) {
        notify("Admin access required.");
        return;
    }
const title = el("taskTitle")?.value.trim() || "";
const description =
    el("taskDescription")?.value.trim() || "";
const taskUrl = el("taskUrl")?.value.trim() || "";
const reward = 20;

const button = el("createTaskButton");

   if (!title) {
    notify("Enter a valid task title.");
    return;
}

    if (taskUrl) {
        try {
            const parsedUrl = new URL(taskUrl);

            if (!["http:", "https:"].includes(parsedUrl.protocol)) {
                throw new Error("Invalid URL protocol.");
            }

        } catch {
            notify("Please enter a valid task URL.");
            return;
        }
    }

    if (button) button.disabled = true;

    try {
        const { error } = await db
            .from("tasks")
            .insert({
                title,
                description,
                task_url: taskUrl || null,
                reward,
                verification_method: "manual",
                is_active: true
            });

        if (error) throw error;

        notify("Task created successfully!");

        el("createTaskForm")?.reset();

        await loadTasks();

    } catch (error) {
        console.error("Create task error:", error);

        notify("Could not create task: " + error.message);

    } finally {
        if (button) button.disabled = false;
    }
}


// =================================================
// 16. ADMIN - LOAD SUBMISSIONS
// =================================================

async function loadAdminSubmissions() {
    if (!db || !currentUser || !isAdmin) return;

    const container = el("adminSubmissions");
    if (!container) return;

    try {
        const { data, error } = await db
            .from("task_submissions")
            .select("id, user_id, proof, status, submitted_at, tasks(title, reward)")
            .eq("status", "pending")
            .order("submitted_at", { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.textContent = "No pending submissions.";
            return;
        }

        container.innerHTML = data.map(item => `
            <article class="card">
                <h3>${escapeHTML(item.tasks?.title || "Task")}</h3>
                <p>User ID: ${escapeHTML(item.user_id)}</p>
                <p>Proof: ${escapeHTML(item.proof || "")}</p>
                <p>Reward: ${money(item.tasks?.reward)}</p>

                <button onclick="approveSubmission('${escapeHTML(item.id)}')">
                    Approve
                </button>

                <button onclick="rejectSubmission('${escapeHTML(item.id)}')">
                    Reject
                </button>
            </article>
        `).join("");

    } catch (error) {
        console.error("Admin submissions error:", error);

        container.textContent =
            "Could not load submissions: " + error.message;
    }
}

async function loadAdminAnalytics() {
    if (!db || !currentUser || !isAdmin) return;

    try {
        const [
            usersResult,
            depositsResult,
            withdrawalsResult,
            pendingDepositsResult,
            pendingWithdrawalsResult,
            rewardsResult
        ] = await Promise.all([

            db.from("profiles")
                .select("*", { count: "exact", head: true }),

            db.from("deposit_requests")
                .select("amount")
                .eq("status", "approved"),

            db.from("withdrawal_requests")
                .select("amount")
                .eq("status", "paid"),

            db.from("deposit_requests")
                .select("*", { count: "exact", head: true })
                .eq("status", "pending"),

            db.from("withdrawal_requests")
                .select("*", { count: "exact", head: true })
                .eq("status", "pending"),

            db.from("wallet_transactions")
                .select("amount")
                .eq("transaction_type", "task_reward")
        ]);

        const results = [
            usersResult,
            depositsResult,
            withdrawalsResult,
            pendingDepositsResult,
            pendingWithdrawalsResult,
            rewardsResult
        ];

        const failed = results.find(result => result.error);
        if (failed) throw failed.error;

        const totalDeposits = depositsResult.data
            .reduce((sum, item) => sum + Number(item.amount), 0);

        const totalWithdrawals = withdrawalsResult.data
            .reduce((sum, item) => sum + Number(item.amount), 0);

        const totalRewards = rewardsResult.data
            .reduce((sum, item) => sum + Number(item.amount), 0);

        const pendingRequests =
            pendingDepositsResult.count +
            pendingWithdrawalsResult.count;

        setText("analyticsUsers", usersResult.count ?? 0);
        setText("analyticsDeposits", money(totalDeposits));
        setText("analyticsWithdrawals", money(totalWithdrawals));
        setText("analyticsPending", pendingRequests);
        setText("analyticsRewards", money(totalRewards));

    } catch (error) {
        console.error("Analytics error:", error);
        notify("Analytics error: " + error.message);
    }
}
// =================================================
// 17. ADMIN - WITHDRAWAL REQUESTS
// =================================================

async function loadAdminWithdrawals() {
    if (!db || !currentUser || !isAdmin) return;

    const container = el("adminWithdrawals");
    if (!container) return;

    try {
        const { data, error } = await db
            .from("withdrawal_requests")
            .select("*")
            .in("status", ["pending", "approved"])
            .order("created_at", { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.textContent =
                "No pending withdrawal requests.";
            return;
        }

        container.innerHTML = data.map(item => `
            <article class="card">
                <h3>Withdrawal: ${money(item.amount)}</h3>
                <p>User ID: ${escapeHTML(item.user_id)}</p>
                <p>Method: ${escapeHTML(item.method)}</p>
                <p>Account Name: ${escapeHTML(item.account_name)}</p>
                <p>Account Number: ${escapeHTML(item.account_number)}</p>
                <p>Status: ${escapeHTML(item.status)}</p>

                ${
                    item.status === "pending"
                    ? `
                        <button onclick="processWithdrawal(${JSON.stringify(item.id)}, true)">
                            Approve
                        </button>
                        <button onclick="processWithdrawal(${JSON.stringify(item.id)}, false)">
                            Reject
                        </button>
                    `
                    : `
                        <button onclick="markWithdrawalPaid(${JSON.stringify(item.id)})">
                            Mark as Paid
                        </button>
                    `
                }
            </article>
        `).join("");

    } catch (error) {
        console.error("Admin withdrawal error:", error);

        container.textContent =
            "Could not load withdrawals: " + error.message;
    }
}


// =================================================
// 18. ADMIN - DEPOSIT REQUESTS
// =================================================

async function loadAdminDeposits() {
    if (!db || !currentUser || !isAdmin) return;

    const container = el("adminDeposits");
    if (!container) return;

    try {
        const { data, error } = await db
            .from("deposit_requests")
           .select("id, amount, user_id, payment_method, transaction_id, status, screenshot_url, created_at")
            .in("status", ["pending", "approved"])
            .order("created_at", { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.textContent = "No deposit requests.";
            return;
        }

        const cards = await Promise.all(data.map(async item => {
            let screenshot = "";

            if (item.screenshot_url) {
                const { data: signed, error: imageError } =
                    await db.storage
                        .from("deposit-screenshots")
                        .createSignedUrl(item.screenshot_url, 600);

                if (!imageError && signed?.signedUrl) {
                    screenshot = `
                        <p><strong>Payment Screenshot:</strong></p>
                        <img src="${escapeHTML(signed.signedUrl)}"
     alt="Deposit payment screenshot"
     loading="lazy"
     decoding="async"
     style="max-width:250px;width:100%;height:auto;border-radius:8px;">
                    `;
                }
            }

            return `
                <article class="card">
                    <h3>Deposit: ${money(item.amount)}</h3>
                    <p>User ID: ${escapeHTML(item.user_id)}</p>
                    <p>Method: ${escapeHTML(item.payment_method)}</p>
                    <p>Transaction ID: ${escapeHTML(item.transaction_id)}</p>
                    <p>Status: ${escapeHTML(item.status)}</p>

                    ${screenshot}

                    ${
                        item.status === "pending"
                        ? `
                            <button onclick="processDeposit(${JSON.stringify(item.id)}, true)">
                                Approve
                            </button>
                            <button onclick="processDeposit(${JSON.stringify(item.id)}, false)">
                                Reject
                            </button>
                        `
                        : ""
                    }
                </article>
            `;
        }));

        container.innerHTML = cards.join("");

    } catch (error) {
        console.error("Admin deposit error:", error);

        container.textContent =
            "Could not load deposits: " + error.message;
    }
}


// =================================================
// 19. ADMIN - PROCESS DEPOSIT
// =================================================

async function processDeposit(depositId, approve) {
    if (!currentUser || !isAdmin) {
        notify("Unauthorized access.");
        return;
    }

    const action = approve ? "approve" : "reject";

    if (!confirm(`Are you sure you want to ${action} this deposit?`)) {
        return;
    }

    try {
        const { data, error } = await db.rpc(
            "admin_process_deposit",
            {
                p_deposit_id: depositId,
                p_approve: approve
            }
        );

        if (error) throw error;

        notify(
            approve
                ? "Deposit approved successfully!"
                : "Deposit rejected successfully!"
        );

        await loadAdminDeposits();

        if (approve && currentUser) {
            await loadDashboard(currentUser);
        }

    } catch (error) {
        console.error("Deposit processing error:", error);

        notify("Deposit processing failed: " + error.message);
    }
}


// =================================================
// 20. ADMIN - MARK WITHDRAWAL PAID
// =================================================

async function markWithdrawalPaid(requestId) {
    if (!currentUser || !isAdmin) {
        notify("Admin access required.");
        return;
    }

    const overlay = document.createElement("div");

    overlay.style.cssText = `
        position:fixed; inset:0; z-index:99999999;
        background:rgba(0,0,0,.85);
        display:flex; align-items:center; justify-content:center;
        padding:20px;
    `;

    overlay.innerHTML = `
        <div style="
            width:100%; max-width:420px; padding:25px;
            background:#0d1e35; border:1px solid #3185ff;
            border-radius:16px; color:white;
        ">
            <h3 style="margin-bottom:15px;color:white;">
                Confirm Withdrawal Payment
            </h3>

            <label style="display:block;margin-bottom:8px;">
                Payment Transaction / Reference ID
            </label>

            <input id="withdrawPaymentReference"
                type="text"
                placeholder="Enter transaction ID"
                style="
                    width:100%;padding:13px;margin-bottom:18px;
                    background:#091a2e;color:white;
                    border:1px solid #3185ff;border-radius:8px;
                ">

            <p style="margin-bottom:18px;color:#a8b8cc;">
                Have you actually transferred the money?
            </p>

            <div style="display:flex;gap:10px;">
                <button id="cancelWithdrawalPayment"
                    style="flex:1;padding:12px;background:#34445a;
                    color:white;border:0;border-radius:8px;">
                    Cancel
                </button>

                <button id="confirmWithdrawalPayment"
                    style="flex:1;padding:12px;background:#16a36a;
                    color:white;border:0;border-radius:8px;">
                    Confirm Paid
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const transactionId = await new Promise(resolve => {
        const input = overlay.querySelector("#withdrawPaymentReference");

        overlay.querySelector("#cancelWithdrawalPayment")
            .onclick = () => {
                overlay.remove();
                resolve(null);
            };

        overlay.querySelector("#confirmWithdrawalPayment")
            .onclick = () => {
                const value = input.value.trim();

                if (!value) {
                    notify("Transaction ID is required.");
                    input.focus();
                    return;
                }

                overlay.remove();
                resolve(value);
            };

        input.focus();
    });

    if (!transactionId) return;

    try {
        const { data, error } = await db.rpc(
            "admin_mark_withdrawal_paid",
            {
                p_request_id: requestId,
                p_transaction_id: transactionId
            }
        );

        if (error) throw error;

        notify(data || "Withdrawal marked as paid.");

        await loadAdminWithdrawals();

    } catch (error) {
        console.error("Mark paid error:", error);
        notify("Payment update failed: " + error.message);
    }
}


// =================================================
// 21. ADMIN - PROCESS WITHDRAWAL
// =================================================

async function processWithdrawal(requestId, approve) {
    if (!currentUser || !isAdmin) {
        notify("Admin access required.");
        return;
    }

    const action = approve ? "approve" : "reject";

    if (!confirm(
        "Are you sure you want to " + action + " this request?"
    )) {
        return;
    }

    try {
        const { error } = await db.rpc(
            "admin_process_withdrawal",
            {
                p_request_id: requestId,
                p_approve: approve
            }
        );

        if (error) throw error;

        notify("Withdrawal " + action + "d successfully.");

        await loadAdminWithdrawals();

        if (approve && currentUser) {
            await loadDashboard(currentUser);
        }

    } catch (error) {
        console.error("Withdrawal processing error:", error);

        notify("Error: " + error.message);
    }
}


// =================================================
// 22. ADMIN - APPROVE SUBMISSION
// =================================================

async function approveSubmission(id) {
    if (!isAdmin) {
        notify("Admin access required.");
        return;
    }

    if (!confirm("Approve this task and credit its reward?")) {
        return;
    }

    try {
        const { data, error } = await db.rpc(
            "approve_task_submission",
            {
                p_submission_id: id
            }
        );

        if (error) throw error;

        notify(data || "Task approved successfully.");

        await loadAdminSubmissions();

        if (currentUser) {
            await loadDashboard(currentUser);
        }

    } catch (error) {
        console.error("Approval error:", error);

        notify("Approval failed: " + error.message);
    }
}


// =================================================
// 23. ADMIN - REJECT SUBMISSION
// =================================================

async function rejectSubmission(id) {
    if (!isAdmin) {
        notify("Admin access required.");
        return;
    }

    if (!confirm("Reject this task submission?")) {
        return;
    }

    try {
        const { data, error } = await db.rpc(
            "reject_task_submission",
            {
                p_submission_id: id
            }
        );

        if (error) throw error;

        notify(data || "Task rejected.");

        await loadAdminSubmissions();
        await loadMySubmissions();

    } catch (error) {
        console.error("Rejection error:", error);

        notify("Rejection failed: " + error.message);
    }
}


// EARNINGS PROGRESS
async function loadEarningsProgress() {
    if (!db || !currentUser) return;

    try {
        const now = new Date();

        const monthStart = new Date(
            now.getFullYear(),
            now.getMonth(),
            1
        ).toISOString();

        const [rewardsResult, pendingResult] = await Promise.all([

            db.from("wallet_transactions")
                .select("amount, created_at")
                .eq("user_id", currentUser.id)
                .eq("transaction_type", "task_reward")
                .gte("created_at", monthStart),

            db.from("task_submissions")
                .select("*", { count: "exact", head: true })
                .eq("user_id", currentUser.id)
                .eq("status", "pending")

        ]);

        if (rewardsResult.error) throw rewardsResult.error;
        if (pendingResult.error) throw pendingResult.error;

        const monthlyEarnings = rewardsResult.data.reduce(
            (sum, item) => sum + Number(item.amount || 0),
            0
        );

        const monthlyTasks = rewardsResult.data.length;
        const pendingTasks = pendingResult.count ?? 0;

        setText("monthlyEarnings", money(monthlyEarnings));
        setText("monthlyTasks", monthlyTasks);
        setText("pendingTasks", pendingTasks);

    } catch (error) {
        console.error("Earnings Progress Error:", error);
        notify("Earnings Progress error: " + error.message);
    }
}

// REFERRAL PROGRAM
async function loadReferralData() {
    if (!db || !currentUser) return;

    try {
        const { data: profile, error } = await db
            .from("profiles")
            .select("referral_code")
            .eq("id", currentUser.id)
            .single();

        if (error) throw error;

        if (!profile.referral_code) {
            throw new Error("Referral code not found in your profile.");
        }

        const referralLink =
            window.location.origin +
            window.location.pathname +
            "?ref=" +
            profile.referral_code;

        const linkInput = el("referralLink");

        if (linkInput) {
            linkInput.value = referralLink;
        }

        const { data: commissions, error: commissionError } = await db
            .from("referral_commissions")
            .select("amount")
            .eq("referrer_id", currentUser.id);

        if (commissionError) throw commissionError;

        const total = commissions.length;

        const earnings = commissions.reduce(
            (sum, item) => sum + Number(item.amount || 0),
            0
        );

        setText("totalReferrals", total);
        setText("referralEarnings", money(earnings));

    } catch (error) {
        console.error("Referral Error:", error);
        notify("Referral Error: " + error.message);
    }
}


// =================================================
// 24. WALLET TRANSACTIONS
// =================================================

async function loadTransactions() {
    if (!db || !currentUser) return;

    const container = el("transactionHistory");
    if (!container) return;

    try {
        const { data, error } = await db
            .from("wallet_transactions")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false });

        if (error) throw error;

        container.innerHTML = `
            <h3>Transaction History</h3>
            <div class="history-list" id="transactionHistoryList"></div>
        `;

        const list = el("transactionHistoryList");

        if (!data || data.length === 0) {
            list.innerHTML = `
                <div class="history-empty">No transactions yet.</div>
            `;
            return;
        }

        list.innerHTML = data.map(item => {
            const type =
                item.transaction_type === "package_purchase"
                    ? "Package Purchase"
                    : item.transaction_type === "task_reward"
                        ? "Task Reward"
                        : item.transaction_type || "Transaction";

            return `
                <article class="history-record">
                    <div class="history-record-top">
                        <h3>${escapeHTML(type)}</h3>
                        <span class="history-status status-approved">
                            ${escapeHTML(type)}
                        </span>
                    </div>

                    <div class="history-record-details">
                        <p>
                            <span>Amount</span>
                            <strong>${money(item.amount)}</strong>
                        </p>

                        <p>
                            <span>Date</span>
                            <strong>${escapeHTML(
                                item.created_at
                                    ? new Date(item.created_at).toLocaleString()
                                    : "N/A"
                            )}</strong>
                        </p>
                    </div>
                </article>
            `;
        }).join("");

    } catch (error) {
        console.error("Transaction error:", error);
        container.textContent = "Could not load transactions.";
    }
}


async function loadPackageHistory() {
    if (!db || !currentUser) return;

    const container = el("myPackageHistory");
    if (!container) return;

    const packageNames = {
        1: "Silver",
        2: "Platinum",
        3: "Gold",
        4: "VIP Gold",
        5: "VVIP Gold",
        6: "Diamond"
    };

    try {
        const { data, error } = await db
            .from("package_orders")
            .select("id, package_id, package_price, daily_reward, duration_days, status, created_at, activated_at, expires_at")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <h3>Package History</h3>
                <div class="history-empty">No package history yet.</div>
            `;
            return;
        }

        container.innerHTML = `
            <h3>Package History</h3>
            <div class="history-list">
                ${data.map(item => {
                    const status = String(item.status || "pending")
                        .toLowerCase()
                        .replace(/[^a-z0-9_-]/g, "");

                    return `
                        <article class="history-record">
                            <div class="history-record-top">
                                <h3>${escapeHTML(packageNames[item.package_id] || "Package")}</h3>
                                <span class="history-status status-${status}">
                                    ${escapeHTML(String(item.status || "Pending").toUpperCase())}
                                </span>
                            </div>

                            <div class="history-record-details">
                                <p>
                                    <span>Package Price</span>
                                    <strong>${money(item.package_price)}</strong>
                                </p>

                                <p>
                                    <span>Daily Reward</span>
                                    <strong>${money(item.daily_reward)}</strong>
                                </p>

                                <p>
                                    <span>Duration</span>
                                    <strong>${escapeHTML(item.duration_days)} Days</strong>
                                </p>

                                <p>
                                    <span>Request Date</span>
                                    <strong>${escapeHTML(item.created_at
                                        ? new Date(item.created_at).toLocaleString()
                                        : "N/A")}</strong>
                                </p>

                                <p>
                                    <span>Activation Date</span>
                                    <strong>${escapeHTML(item.activated_at
                                        ? new Date(item.activated_at).toLocaleDateString()
                                        : "Not activated")}</strong>
                                </p>

                                <p>
                                    <span>Expiry Date</span>
                                    <strong>${escapeHTML(item.expires_at
                                        ? new Date(item.expires_at).toLocaleDateString()
                                        : "N/A")}</strong>
                                </p>
                            </div>
                        </article>
                    `;
                }).join("")}
            </div>
        `;

    } catch (error) {
        console.error("Package history error:", error);
        container.textContent = "Could not load package history.";
    }
}


async function loadCurrentActivePackage() {
    if (!db || !currentUser) return;

    const container = el("activePackageDetails");
    if (!container) return;

    const packageNames = {
        1: "Silver",
        2: "Platinum",
        3: "Gold",
        4: "VIP Gold",
        5: "VVIP Gold",
        6: "Diamond"
    };

    try {
        const { data, error } = await db
            .from("package_orders")
            .select("package_id, package_price, daily_reward, duration_days, activated_at, expires_at")
            .eq("user_id", currentUser.id)
            .eq("status", "active")
            .order("activated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            container.textContent = "No active package.";
            return;
        }

        container.innerHTML = `
            <article class="card">
                <h3>${escapeHTML(packageNames[data.package_id] || "Package")}</h3>
                <p>Status: ACTIVE</p>
                <p>Price: ${money(data.package_price)}</p>
                <p>Daily Reward: ${money(data.daily_reward)}</p>
                <p>Duration: ${escapeHTML(data.duration_days)} Days</p>
                <p>Activation Date: ${data.activated_at ? escapeHTML(new Date(data.activated_at).toLocaleDateString()) : "N/A"}</p>
                <p>Expiry Date: ${data.expires_at ? escapeHTML(new Date(data.expires_at).toLocaleDateString()) : "N/A"}</p>
            </article>
        `;

    } catch (error) {
        console.error("Current package error:", error);
        container.textContent = "Could not load active package.";
    }
}


// =================================================
// 25. LOGOUT
// =================================================

async function logout() {
    if (!db) return;

    try {
        const { error } = await db.auth.signOut();

        if (error) throw error;

        notify("Logged out successfully.");

    } catch (error) {
        console.error("Logout error:", error);

        notify("Logout failed: " + error.message);
    }
}


// =================================================
// 26. AUTH STATE LISTENER
// =================================================
function setupAuthListener() {
    if (!db) return;

    db.auth.onAuthStateChange((event, session) => {

        if (event === "PASSWORD_RECOVERY") {
            showPasswordRecoveryForm();
        }

        if (event === "SIGNED_OUT") {
            currentUser = null;
            isAdmin = false;

            updateAuthButtons(null);

            el("dashboard")?.classList.add("hidden");
            el("adminPanel")?.classList.add("hidden");

            showHome();
        }
    });
}

// =================================================
// 27. INITIALIZE WEBSITE
// =================================================

async function initializeEarnHub() {
    if (!db) {
        console.error(
            "Supabase client not found. Check supabase.js."
        );
        return;
    }

    try {
        const { data, error } = await db.auth.getSession();

        if (error) throw error;

        if (data.session?.user) {
            await loadDashboard(data.session.user);
        } else {
            currentUser = null;
            isAdmin = false;

            updateAuthButtons(null);
            showHome();
        }

    } catch (error) {
        console.error("Website initialization error:", error);
    }
}


// =================================================
// 28. SIDEBAR MENU
// =================================================

function toggleMainMenu() {
    const sidebar = el("mainSidebar");
    const overlay = el("menuOverlay");

    if (!sidebar || !overlay) return;

    sidebar.classList.toggle("active");
    overlay.classList.toggle("active");
}

function closeMainMenu() {
    el("mainSidebar")?.classList.remove("active");
    el("menuOverlay")?.classList.remove("active");
}

function setActiveMenu(section) {
    document.querySelectorAll(".sidebar-link").forEach(link => {
        link.classList.remove("active");
    });

    const activeLink = document.querySelector(
        `.sidebar-link[onclick*="'${section}'"]`
    );

    if (activeLink) {
        activeLink.classList.add("active");
    }
}

async function navigateMenu(section) {

    closeMainMenu();

    if (!currentUser) {
        showLogin();
        return;
    }

    if (section === "dashboard") {
        await openDashboard();
        return;
    }

    const targets = {
        deposit: "depositSection",
        withdraw: "withdrawForm",
        tasks: "tasks",
        referral: "referral",
        currentActivePackage: "currentActivePackage"
    };

    const targetId = targets[section];

    if (!targetId) return;

    if (document.getElementById("dashboard")?.classList.contains("hidden")) {
        await openDashboard();
    }

    if (section === "withdraw") {
        showWithdrawForm();
    }

    setActiveMenu(section);

    setTimeout(() => {

        const target = document.getElementById(targetId);

        if (!target) {
            console.error("Target not found:", targetId);
            return;
        }

        const top = target.getBoundingClientRect().top + window.scrollY - 100;

        window.scrollTo({
            top: top,
            behavior: "smooth"
        });

    }, 300);
}

// =================================================
// 29. KEYBOARD EVENTS
// =================================================

document.addEventListener("keydown", function(event) {
    if (event.key === "Escape") {
        closeMainMenu();
    }
});


// =================================================
// 30. START APPLICATION
// =================================================

document.addEventListener("DOMContentLoaded", () => {
    if (!db) {
        console.error(
            "Supabase connection missing. Check your supabase.js file."
        );
        return;
    }

    const authForm = el("authForm");

    if (authForm) {
        authForm.addEventListener("submit", handleAuthSubmit);
    }

    const taskForm = el("createTaskForm");

    if (taskForm) {
        taskForm.addEventListener("submit", handleCreateTask);
    }

    const depositMethod = el("depositMethod");

    if (depositMethod) {
        depositMethod.addEventListener(
            "change",
            updateDepositPaymentDetails
        );

        updateDepositPaymentDetails();
    }

    setupAuthListener();
    initializeEarnHub();
});

// =================================================
// 31. NOTIFICATIONS SYSTEM
// =================================================

async function loadNotifications() {
    if (!db || !currentUser) return;

    const container = el("notificationList");
    const count = el("notificationCount");

    if (!container) return;

    container.textContent = "Loading notifications...";

    try {
        const { data, error } = await db
            .from("notifications")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false })
            .limit(30);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.textContent = "No notifications yet.";
            if (count) count.textContent = "0";
            return;
        }

        const unread = data.filter(item => !item.is_read).length;

        if (count) count.textContent = unread + " New";

        container.innerHTML = data.map(item => `
            <article class="card notification-item">
                <h3>${escapeHTML(item.title)}</h3>
                <p>${escapeHTML(item.message)}</p>
                <small>
                    ${new Date(item.created_at).toLocaleString()}
                </small>
                ${
                    item.is_read
                    ? '<span>Read</span>'
                    : `
                        <button onclick="markNotificationRead(${JSON.stringify(item.id)})">
                            Mark as Read
                        </button>
                    `
                }
            </article>
        `).join("");

    } catch (error) {
        console.error("Notifications error:", error);
        container.textContent =
            "Could not load notifications: " + error.message;
    }
}


// =================================================
// 32. MARK NOTIFICATION AS READ
// =================================================

async function markNotificationRead(notificationId) {
    if (!db || !currentUser) return;

    try {
        const { error } = await db
            .from("notifications")
            .update({ is_read: true })
            .eq("id", notificationId)
            .eq("user_id", currentUser.id);

        if (error) throw error;

        await loadNotifications();

    } catch (error) {
        console.error("Mark notification read error:", error);
        notify("Could not update notification: " + error.message);
    }
}
// ========================================
// COPY REFERRAL LINK
// ========================================
async function copyReferralLink() {

    const referralInput = document.getElementById("referralLink");

    const referralUrl = referralInput.value;

    if (!referralUrl) {
        alert("Referral link is not loaded yet!");
        return;
    }

    try {

        await navigator.clipboard.writeText(referralUrl);

        alert("Referral link copied successfully!");

    } catch (error) {

        referralInput.focus();
        referralInput.select();

        const copied = document.execCommand("copy");

        if (copied) {
            alert("Referral link copied successfully!");
        } else {
            alert("Please copy the link manually.");
        }

    }
}

/* ========================================
   EARNHUB PACKAGE ACTIVATION
======================================== */


/* ========================================
   EARNHUB PACKAGE ACTIVATION
======================================== */

async function activatePackage(packageName) {

    const packageIds = {
        silver: 1,
        platinum: 2,
        gold: 3,
        vip_gold: 4,
        vvip_gold: 5,
        diamond: 6
    };

    const packageId = packageIds[packageName];

    if (!packageId) {
        alert("Invalid package selected.");
        return;
    }

    const client = window.supabaseClient;

    if (!client) {
        alert("Database connection not available.");
        return;
    }

    const confirmed = confirm(
        "Do you want to submit this package request for admin approval?"
    );

    if (!confirmed) return;

    try {

        const { data, error } = await client.rpc(
            "request_package",
            {
                p_package_id: packageId
            }
        );

        if (error) {
            throw error;
        }

        alert(
            "Package request submitted successfully! " +
            "Your request is now Pending Admin Approval."
        );

        location.reload();

    } catch (error) {

        console.error("Package Request Error:", error);

        alert(
            "Package request failed: " + error.message
        );
    }
}

// TOGGLE NOTIFICATION DROPDOWN
window.toggleNotifications = function () {
    const dropdown = document.getElementById("notificationDropdown");

    if (!dropdown) return;

    dropdown.hidden = !dropdown.hidden;
};
window.closeModal = function () {
    document.getElementById("authModal")?.classList.add("hidden");
};
