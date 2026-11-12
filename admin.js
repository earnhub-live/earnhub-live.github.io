
const db = window.supabaseClient;

let adminUser = null;
let adminVerified = false;

const $ = id => document.getElementById(id);

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function money(value) {
    return "$" + Number(value || 0).toFixed(2);
}

function showDenied(message) {
    $("adminLoader")?.classList.add("hidden");
    $("adminApp")?.classList.add("hidden");
    $("accessDenied")?.classList.remove("hidden");

    const paragraph = $("accessDenied")?.querySelector("p");
    if (paragraph) paragraph.textContent = message;
}

async function verifyAdmin() {
    if (!db) {
        showDenied("Supabase connection could not be established.");
        return false;
    }

    const { data: sessionData, error: sessionError } =
        await db.auth.getSession();

    if (sessionError) throw sessionError;

    const user = sessionData.session?.user;

    if (!user) {
        window.location.replace("index.html");
        return false;
    }

    const { data, error } = await db.rpc("is_admin");

    if (error) throw error;

    if (data !== true) {
        showDenied("Your account does not have administrator permission.");
        return false;
    }

    adminUser = user;
    adminVerified = true;

    $("adminLoader")?.classList.add("hidden");
    $("accessDenied")?.classList.add("hidden");
    $("adminApp")?.classList.remove("hidden");

    $("adminEmail").textContent = user.email || "Administrator";

    return true;
}

// ======================================
// ADMIN ANALYTICS
// ======================================

async function loadAdminAnalytics() {
    if (!adminVerified) return;

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

        const sum = rows =>
            (rows || []).reduce(
                (total, row) => total + Number(row.amount || 0),
                0
            );

        $("analyticsUsers").textContent =
            usersResult.count ?? 0;

        $("analyticsDeposits").textContent =
            money(sum(depositsResult.data));

        $("analyticsWithdrawals").textContent =
            money(sum(withdrawalsResult.data));

        $("analyticsPending").textContent =
            (pendingDepositsResult.count ?? 0) +
            (pendingWithdrawalsResult.count ?? 0);

        $("analyticsRewards").textContent =
            money(sum(rewardsResult.data));

    } catch (error) {
        console.error("Analytics error:", error);
        alert("Analytics error: " + error.message);
    }
}

// ======================================
// TASK SUBMISSIONS
// ======================================

async function loadAdminSubmissions() {
    if (!adminVerified) return;

    const container = $("adminSubmissions");

    try {
        const { data, error } = await db
            .from("task_submissions")
            .select("id, user_id, proof, status, submitted_at, tasks(title, reward)")
            .eq("status", "pending")
            .order("submitted_at", { ascending: true });

        if (error) throw error;

        if (!data?.length) {
            container.textContent = "No pending submissions.";
            return;
        }

        container.innerHTML = data.map(item => `
            <article class="card">
                <h3>${escapeHTML(item.tasks?.title || "Task")}</h3>
                <p>User ID: ${escapeHTML(item.user_id)}</p>
                <p>Proof: ${escapeHTML(item.proof || "")}</p>
                <p>Reward: ${money(item.tasks?.reward)}</p>

                <button onclick="adminApproveTask(${JSON.stringify(item.id)})">
                    Approve
                </button>

                <button onclick="adminRejectTask(${JSON.stringify(item.id)})">
                    Reject
                </button>
            </article>
        `).join("");

    } catch (error) {
        console.error("Submissions error:", error);
        container.textContent = "Could not load submissions: " + error.message;
    }
}

window.adminApproveTask = async function(id) {
    if (!adminVerified) return;

    if (!confirm("Approve this task and credit its reward?")) return;

    try {
        const { data, error } = await db.rpc(
            "approve_task_submission",
            { p_submission_id: id }
        );

        if (error) throw error;

        alert(data || "Task approved successfully.");

        await Promise.all([
            loadAdminSubmissions(),
            loadAdminAnalytics()
        ]);

    } catch (error) {
        alert("Approval failed: " + error.message);
    }
};

window.adminRejectTask = async function(id) {
    if (!adminVerified) return;

    if (!confirm("Reject this task submission?")) return;

    try {
        const { data, error } = await db.rpc(
            "reject_task_submission",
            { p_submission_id: id }
        );

        if (error) throw error;

        alert(data || "Task rejected.");

        await loadAdminSubmissions();

    } catch (error) {
        alert("Rejection failed: " + error.message);
    }
};

// ======================================
// WITHDRAWAL REQUESTS
// ======================================

async function loadAdminWithdrawals() {
    if (!adminVerified) return;

    const container = $("adminWithdrawals");

    try {
        const { data, error } = await db
            .from("withdrawal_requests")
            .select("*")
            .in("status", ["pending", "approved"])
            .order("created_at", { ascending: true });

        if (error) throw error;

        if (!data?.length) {
            container.textContent = "No pending withdrawal requests.";
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
                        <button onclick="adminProcessWithdrawal(${JSON.stringify(item.id)}, true)">
                            Approve
                        </button>
                        <button onclick="adminProcessWithdrawal(${JSON.stringify(item.id)}, false)">
                            Reject
                        </button>
                    `
                    : `
                        <button onclick="adminMarkPaid(${JSON.stringify(item.id)})">
                            Mark as Paid
                        </button>
                    `
                }
            </article>
        `).join("");

    } catch (error) {
        console.error("Withdrawal error:", error);
        container.textContent = "Could not load withdrawals: " + error.message;
    }
}

window.adminProcessWithdrawal = async function(id, approve) {
    if (!adminVerified) return;

    const action = approve ? "approve" : "reject";

    if (!confirm("Are you sure you want to " + action + " this request?")) {
        return;
    }

    try {
        const { error } = await db.rpc(
            "admin_process_withdrawal",
            {
                p_request_id: id,
                p_approve: approve
            }
        );

        if (error) throw error;

        alert("Withdrawal " + action + "d successfully.");

        await Promise.all([
            loadAdminWithdrawals(),
            loadAdminAnalytics()
        ]);

    } catch (error) {
        alert("Withdrawal error: " + error.message);
    }
};

window.adminMarkPaid = async function(id) {
    if (!adminVerified) return;

    const transactionId = prompt(
        "Enter the payment transaction/reference ID:"
    );

    if (!transactionId?.trim()) {
        alert("Transaction ID is required.");
        return;
    }

    if (!confirm("Have you actually transferred the money?")) return;

    try {
        const { data, error } = await db.rpc(
            "admin_mark_withdrawal_paid",
            {
                p_request_id: id,
                p_transaction_id: transactionId.trim()
            }
        );

        if (error) throw error;

        alert(data || "Withdrawal marked as paid.");

        await Promise.all([
            loadAdminWithdrawals(),
            loadAdminAnalytics()
        ]);

    } catch (error) {
        alert("Payment update failed: " + error.message);
    }
};

// ======================================
// DEPOSIT REQUESTS
// ======================================

async function loadAdminDeposits() {
    if (!adminVerified) return;

    const container = $("adminDeposits");

    try {
        const { data, error } = await db
            .from("deposit_requests")
            .select("*")
            .in("status", ["pending", "approved"])
            .order("created_at", { ascending: true });

        if (error) throw error;

        if (!data?.length) {
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
                             alt="Deposit screenshot"
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
                            <button onclick="adminProcessDeposit(${JSON.stringify(item.id)}, true)">
                                Approve
                            </button>
                            <button onclick="adminProcessDeposit(${JSON.stringify(item.id)}, false)">
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
        console.error("Deposit error:", error);
        container.textContent = "Could not load deposits: " + error.message;
    }
}

window.adminProcessDeposit = async function(id, approve) {
    if (!adminVerified) return;

    const action = approve ? "approve" : "reject";

    if (!confirm("Are you sure you want to " + action + " this deposit?")) {
        return;
    }

    try {
        const { data, error } = await db.rpc(
            "admin_process_deposit",
            {
                p_deposit_id: id,
                p_approve: approve
            }
        );

        if (error) throw error;

        alert(
            approve
                ? "Deposit approved successfully!"
                : "Deposit rejected successfully!"
        );

        await Promise.all([
            loadAdminDeposits(),
            loadAdminAnalytics()
        ]);

    } catch (error) {
        alert("Deposit processing failed: " + error.message);
    }
};

// ======================================
// CREATE TASK
// ======================================

$("createTaskForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    if (!adminVerified) {
        alert("Admin access required.");
        return;
    }

    const title = $("taskTitle").value.trim();
    const description = $("taskDescription").value.trim();
    const taskUrl = $("taskUrl").value.trim();
    const reward = Number($("taskReward").value);
    const button = $("createTaskButton");

    if (!title || !Number.isFinite(reward) || reward <= 0) {
        alert("Enter a valid task title and reward.");
        return;
    }

    if (taskUrl) {
        try {
            const parsed = new URL(taskUrl);

            if (!["http:", "https:"].includes(parsed.protocol)) {
                throw new Error("Invalid URL.");
            }
        } catch {
            alert("Please enter a valid task URL.");
            return;
        }
    }

    button.disabled = true;

    try {
        const { error } = await db.from("tasks").insert({
            title,
            description,
            task_url: taskUrl || null,
            reward,
            verification_method: "manual",
            is_active: true
        });

        if (error) throw error;

        alert("Task created successfully!");
        $("createTaskForm").reset();

    } catch (error) {
        alert("Could not create task: " + error.message);
    } finally {
        button.disabled = false;
    }
});

// ======================================
// REFRESH DASHBOARD
// ======================================

async function refreshAdminDashboard() {
    if (!adminVerified) return;

    await Promise.all([
        loadAdminAnalytics(),
        loadAdminSubmissions(),
        loadAdminWithdrawals(),
        loadAdminDeposits()
    ]);
}

$("refreshAll")?.addEventListener("click", refreshAdminDashboard);

// ======================================
// LOGOUT
// ======================================

$("logoutButton")?.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to logout?")) return;

    const { error } = await db.auth.signOut();

    if (error) {
        alert("Logout failed: " + error.message);
        return;
    }

    window.location.replace("index.html");
});

// ======================================
// INITIALIZE ADMIN PANEL
// ======================================

async function initializeAdminPanel() {
    try {
        const allowed = await verifyAdmin();

        if (allowed) {
            await refreshAdminDashboard();
        }

    } catch (error) {
        console.error("Admin initialization error:", error);
        showDenied("Could not verify administrator access: " + error.message);
    }
}

initializeAdminPanel();

db?.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
        window.location.replace("index.html");
    }
});
