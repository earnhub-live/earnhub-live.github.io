
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
    return "$" + Number(value || 0).toFixed(2);
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

    const name = el("authName");

    if (name) {
        name.classList.remove("hidden");
        name.required = true;
    }

    const switchElement = el("authSwitch");

    if (switchElement) {
        switchElement.innerHTML =
            'Already have an account? <a href="#" onclick="showLogin(); return false;">Login</a>';
    }
}

function showLogin() {
    authMode = "login";

    el("authModal")?.classList.remove("hidden");

    setText("modalTitle", "Welcome Back");
    setText("authSubmit", "Login");
    setText("authMessage", "");

    const name = el("authName");

    if (name) {
        name.classList.add("hidden");
        name.required = false;
    }

    const switchElement = el("authSwitch");

    if (switchElement) {
        switchElement.innerHTML =
            'New to EarnHub? <a href="#" onclick="showSignup(); return false;">Create Account</a>';
    }
}

function closeModal() {
    el("authModal")?.classList.add("hidden");
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

    const name = el("authName")?.value.trim() || "";
    const email = el("authEmail")?.value.trim() || "";
    const password = el("authPassword")?.value || "";

    const message = el("authMessage");
    const button = el("authSubmit");

    if (!email || !password) {
        if (message) message.textContent = "Enter email and password.";
        return;
    }

    if (authMode === "signup" && !name) {
        if (message) message.textContent = "Enter your full name.";
        return;
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
                        full_name: name
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
                        "Account created. Please login to continue.";
                }
            }

        } else {
            const { data, error } = await db.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            closeModal();
            await loadDashboard(data.user);
        }

    } catch (error) {
        console.error("Authentication error:", error);

        if (message) {
            message.textContent = error.message;
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

    if (user) {
        const name =
            user.user_metadata?.full_name ||
            user.email ||
            "User";

        nav.innerHTML = `
            <span>Hi, ${escapeHTML(name)}</span>
            <button onclick="openDashboard()">Dashboard</button>
            <button onclick="logout()">Logout</button>
        `;
    } else {
        nav.innerHTML = `
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

        await checkAdmin();
await Promise.all([
    loadAdminWithdrawals(),
    loadAdminDeposits(),
    loadTasks(),
    loadMySubmissions(),
    loadTransactions(),
    loadWithdrawalHistory(),
    loadDepositHistory()
]);
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

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

        panel?.classList.toggle("hidden", !isAdmin);

        if (isAdmin) {
            await loadAdminSubmissions();
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
            .order("created_at", { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.textContent = "No tasks available right now.";
            return;
        }

        container.innerHTML = data.map(task => `
            <article class="card">
                <h3>${escapeHTML(task.title)}</h3>
                <p>${escapeHTML(task.description || "")}</p>
                <p>Reward: ${money(task.reward)}</p>

                <button onclick="startTask('${escapeHTML(task.id)}')">
                    Start Task
                </button>
            </article>
        `).join("");

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

        const proof = prompt("Enter your task completion proof:");

        if (proof === null || !proof.trim()) {
            notify("Proof is required.");
            return;
        }

        const { error: submitError } = await db
            .from("task_submissions")
            .insert({
                user_id: currentUser.id,
                task_id: task.id,
                proof: proof.trim(),
                status: "pending"
            });

        if (submitError) throw submitError;

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

    if (!Number.isFinite(amount) || amount < 5) {
        notify("Minimum withdrawal amount is $5.");
        return;
    }

    if (!["JazzCash", "EasyPaisa", "Bank Transfer"].includes(method)) {
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

        if (amount > Number(profile.available_balance || 0)) {
            notify("Insufficient wallet balance.");
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

    if (method === "JazzCash") {
        name.textContent = "JazzCash Account";
        number.textContent = "03438880689";
    } else {
        name.textContent = "Easypaisa Account";
        number.textContent = "03184833441";
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

    if (!Number.isFinite(amount) || amount < 3) {
        notify("Minimum deposit amount is $3 USD.");
        return;
    }

    if (!["JazzCash", "Easypaisa"].includes(method)) {
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

        if (!data || data.length === 0) {
            container.innerHTML =
                "<h3>Deposit History</h3>No deposits yet.";
            return;
        }

        container.innerHTML = "<h3>Deposit History</h3>";

        data.forEach(request => {
            const item = document.createElement("div");
            item.className = "card";

            item.innerHTML = `
                <h3>Deposit: ${money(request.amount)}</h3>
                <p>Method: ${escapeHTML(request.payment_method)}</p>
                <p>Transaction ID: ${escapeHTML(request.transaction_id)}</p>
                <p>Status: <strong>${escapeHTML(
                    String(request.status).toUpperCase()
                )}</strong></p>
                <p>Requested: ${
                    request.created_at
                    ? new Date(request.created_at).toLocaleString()
                    : "N/A"
                }</p>
            `;

            container.appendChild(item);
        });

    } catch (error) {
        console.error("Deposit history error:", error);

        container.textContent =
            "Could not load deposit history: " + error.message;
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

        if (!data || data.length === 0) {
            container.textContent =
                "No withdrawal requests yet.";
            return;
        }

        container.innerHTML = "<h3>Withdrawal History</h3>";

        data.forEach(request => {
            const item = document.createElement("div");
            item.className = "card";

            const status = String(request.status).toUpperCase();

            item.innerHTML = `
                <h3>Withdrawal: ${money(request.amount)}</h3>
                <p>Method: ${escapeHTML(request.method)}</p>
                <p>Status: <strong>${escapeHTML(status)}</strong></p>
                <p>Requested: ${
                    request.created_at
                    ? new Date(request.created_at).toLocaleString()
                    : "N/A"
                }</p>
                ${
                    request.transaction_id
                    ? `<p>Transaction ID: ${escapeHTML(request.transaction_id)}</p>`
                    : ""
                }
                ${
                    request.paid_at
                    ? `<p>Paid Date: ${new Date(request.paid_at).toLocaleString()}</p>`
                    : ""
                }
            `;

            container.appendChild(item);
        });

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
            container.textContent = "No submissions yet.";
            return;
        }

        container.innerHTML = data.map(item => `
            <article class="card">
                <h3>${escapeHTML(item.tasks?.title || "Task")}</h3>
                <p>Reward: ${money(item.tasks?.reward)}</p>
                <p>Proof: ${escapeHTML(item.proof || "")}</p>
                <p>Status: <strong>${escapeHTML(item.status)}</strong></p>
                <p>${escapeHTML(
                    item.submitted_at
                        ? new Date(item.submitted_at).toLocaleString()
                        : ""
                )}</p>
            </article>
        `).join("");

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
    const reward = Number(el("taskReward")?.value);

    const button = el("createTaskButton");

    if (!title || !Number.isFinite(reward) || reward <= 0) {
        notify("Enter a valid task title and reward.");
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
                        <button onclick="processWithdrawal(${Number(item.id)}, true)">
                            Approve
                        </button>
                        <button onclick="processWithdrawal(${Number(item.id)}, false)">
                            Reject
                        </button>
                    `
                    : `
                        <button onclick="markWithdrawalPaid(${Number(item.id)})">
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
            .select("*")
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
                             style="max-width:250px;width:100%;border-radius:8px;">
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
                            <button onclick="processDeposit(${Number(item.id)}, true)">
                                Approve
                            </button>
                            <button onclick="processDeposit(${Number(item.id)}, false)">
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

    const transactionId = prompt(
        "Enter the JazzCash/Easypaisa transaction ID:"
    );

    if (!transactionId || !transactionId.trim()) {
        notify("Transaction ID is required.");
        return;
    }

    if (!confirm("Have you actually transferred the money?")) {
        return;
    }

    try {
        const { data, error } = await db.rpc(
            "admin_mark_withdrawal_paid",
            {
                p_request_id: requestId,
                p_transaction_id: transactionId.trim()
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

        if (!data || data.length === 0) {
            container.textContent = "No transactions yet.";
            return;
        }

        container.innerHTML = data.map(item => `
            <article class="card">
                <p>Type: ${escapeHTML(item.transaction_type)}</p>
                <p>Amount: ${money(item.amount)}</p>
                <p>Date: ${escapeHTML(
                    item.created_at
                        ? new Date(item.created_at).toLocaleString()
                        : ""
                )}</p>
            </article>
        `).join("");

    } catch (error) {
        console.error("Transaction error:", error);

        container.textContent = "Could not load transactions.";
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
    setActiveMenu(section);
    closeMainMenu();

    if (section === "dashboard") {
        await openDashboard();
        return;
    }

    if (!currentUser) {
        showLogin();
        return;
    }

    if (el("dashboard")?.classList.contains("hidden")) {
        await openDashboard();
    }

    let target = null;

    if (section === "deposit") {
        target = el("depositSection");
    }

    if (section === "withdraw") {
        target = document.querySelector(".withdrawal-premium");
    }

    if (section === "tasks") {
        target = el("tasks");
    }

    if (target) {
        setTimeout(() => {
            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }, 250);
    } else {
        console.log("Section not found:", section);
    }
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
