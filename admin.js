
const db = window.supabaseClient;

let adminUser = null;
let adminVerified = false;
let platformChart = null;

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
    return "₨" + Number(value || 0).toFixed(2);
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

async function loadPlatformChart() {
    if (!adminVerified || typeof Chart === "undefined") return;

    const canvas = $("platformChart");
    if (!canvas) return;

    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const startDate = sevenDaysAgo.toISOString();

        const [users, deposits, withdrawals] = await Promise.all([
            db.from("profiles")
                .select("created_at")
                .gte("created_at", startDate),

            db.from("deposit_requests")
                .select("amount, created_at")
                .eq("status", "approved")
                .gte("created_at", startDate),

            db.from("withdrawal_requests")
                .select("amount, created_at")
                .eq("status", "paid")
                .gte("created_at", startDate)
        ]);

        const results = [users, deposits, withdrawals];
        const failed = results.find(result => result.error);
        if (failed) throw failed.error;

        const dates = [];

        for (let i = 0; i < 7; i++) {
            const date = new Date(sevenDaysAgo);
            date.setDate(date.getDate() + i);
            dates.push(date);
        }

        const getDailyData = (rows, field) => dates.map(date => {
            const total = (rows || [])
                .filter(row => {
                    const itemDate = new Date(row.created_at);

                    return itemDate.getFullYear() === date.getFullYear() &&
                        itemDate.getMonth() === date.getMonth() &&
                        itemDate.getDate() === date.getDate();
                })
                .reduce((sum, row) => sum + Number(row[field] ?? 1), 0);

            return total;
        });

        const labels = dates.map(date =>
            date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric"
            })
        );

        if (platformChart) {
            platformChart.destroy();
        }

        platformChart = new Chart(canvas, {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: "Users",
                        data: getDailyData(users.data, "count"),
                        borderColor: "#8b5cf6",
                        backgroundColor: "#8b5cf6",
                        tension: 0.4
                    },
                    {
                        label: "Deposits",
                        data: getDailyData(deposits.data, "amount"),
                        borderColor: "#10b981",
                        backgroundColor: "#10b981",
                        tension: 0.4
                    },
                    {
                        label: "Withdrawals",
                        data: getDailyData(withdrawals.data, "amount"),
                        borderColor: "#f59e0b",
                        backgroundColor: "#f59e0b",
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: "#ffffff" }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: "#c4b5fd" },
                        grid: { color: "#292743" }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: "#c4b5fd" },
                        grid: { color: "#292743" }
                    }
                }
            }
        });

    } catch (error) {
        console.error("Platform chart error:", error);
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

               <button onclick="adminApproveTask('${escapeHTML(item.id)}')">
                    Approve
                </button>

              <button onclick="adminRejectTask('${escapeHTML(item.id)}')">
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
// ======================================
// SPONSORED CAMPAIGNS
// ======================================

async function loadAdminSponsoredCampaigns() {
    if (!adminVerified) return;

    const container = $("adminSponsoredCampaigns");
    if (!container) return;

    container.textContent = "Loading sponsored campaigns...";

    try {
        const { data, error } = await db
            .from("sponsor_payments")
            .select(`
                id, task_id, sponsor_id, sponsor_company,
                payment_method, payment_amount, transaction_id,
                submitted_at, screenshot_url
            `)
            .eq("payment_status", "pending")
            .order("submitted_at", { ascending: true });

        if (error) throw error;

        if (!data?.length) {
            container.textContent = "No pending sponsored payments.";
            return;
        }

        container.innerHTML = data.map(item => `
            <article class="card">
                <h3>${escapeHTML(item.sponsor_company)}</h3>
                <p>Task ID: ${escapeHTML(item.task_id)}</p>
                <p>Amount: ${money(item.payment_amount)}</p>
                <p>Method: ${escapeHTML(item.payment_method)}</p>
                <p>Transaction ID: ${escapeHTML(item.transaction_id)}</p>
                <p>Submitted: ${escapeHTML(item.submitted_at)}</p>
                ${
                    item.screenshot_url
                    ? `<p><a href="#" onclick="adminViewSponsorScreenshot('${escapeHTML(item.id)}'); return false;">View Payment Screenshot</a></p>`
                    : "<p>No screenshot provided.</p>"
                }
                <button onclick="adminVerifySponsoredCampaign('${escapeHTML(item.task_id)}')">
                    Verify Payment & Activate Campaign
                </button>
            </article>
        `).join("");

    } catch (error) {
        console.error("Sponsored campaigns error:", error);
        container.textContent = "Could not load sponsored payments: " + error.message;
    }
}

window.adminViewSponsorScreenshot = async function(paymentId) {
    if (!adminVerified) return;

    try {
        const { data: payment, error } = await db
            .from("sponsor_payments")
            .select("screenshot_url")
            .eq("id", paymentId)
            .single();

        if (error) throw error;
        if (!payment.screenshot_url) throw new Error("Screenshot not found.");

        const { data, error: urlError } = await db.storage
            .from("deposit-screenshots")
            .createSignedUrl(payment.screenshot_url, 300);

        if (urlError) throw urlError;

        window.open(data.signedUrl, "_blank", "noopener");

    } catch (error) {
        alert("Screenshot error: " + error.message);
    }
};

window.adminVerifySponsoredCampaign = async function(taskId) {
    if (!adminVerified) return;

    if (!confirm("Verify sponsor payment and activate this campaign?")) {
        return;
    }

    try {
        const { error } = await db.rpc(
            "admin_verify_sponsored_campaign",
            { p_task_id: taskId }
        );

        if (error) throw error;

        alert("Sponsored campaign verified and activated!");
        await loadAdminSponsoredCampaigns();

    } catch (error) {
        alert("Verification failed: " + error.message);
    }
};

$("refreshSponsoredCampaigns")?.addEventListener(
    "click",
    loadAdminSponsoredCampaigns
);
// ======================================
// PACKAGE REQUESTS
// ======================================

async function loadAdminPackageRequests() {
    if (!adminVerified) return;

    const container = $("adminPackageRequests");
    if (!container) return;

    container.textContent = "Loading package requests...";

    try {
        const { data, error } = await db
            .from("package_orders")
            .select("id, user_id, package_id, package_price, daily_reward, duration_days, status, created_at")
            .eq("status", "pending")
            .order("created_at", { ascending: true });

        if (error) throw error;

        if (!data?.length) {
            container.textContent = "No pending package requests.";
            return;
        }

        container.innerHTML = data.map(item => `
            <article class="card">
                <h3>Package Request #${escapeHTML(item.id)}</h3>
                <p>User ID: ${escapeHTML(item.user_id)}</p>
                <p>Package ID: ${escapeHTML(item.package_id)}</p>
                <p>Package Price: ${money(item.package_price)}</p>
                <p>Daily Reward: ${money(item.daily_reward)}</p>
                <p>Duration: ${escapeHTML(item.duration_days)} Days</p>
                <p>Status: Pending</p>

                <button onclick="adminApprovePackage(${JSON.stringify(item.id)})">
                    Approve
                </button>

                <button onclick="adminRejectPackage(${JSON.stringify(item.id)})">
                    Reject
                </button>
            </article>
        `).join("");

    } catch (error) {
        console.error("Package requests error:", error);
        container.textContent =
            "Could not load package requests: " + error.message;
    }
}

window.adminApprovePackage = async function(id) {
    if (!adminVerified) return;

    if (!confirm("Approve this package? User balance will be deducted.")) {
        return;
    }

    try {
        const { data, error } = await db.rpc(
            "admin_approve_package",
            { p_order_id: id }
        );

        if (error) throw error;

        alert("Package approved successfully!");

        await loadAdminPackageRequests();

    } catch (error) {
        alert("Package approval failed: " + error.message);
    }
};

window.adminRejectPackage = async function(id) {
    if (!adminVerified) return;

    if (!confirm("Are you sure you want to reject this package request?")) {
        return;
    }

    try {
        const { data, error } = await db.rpc(
            "admin_reject_package",
            { p_order_id: id }
        );

        if (error) throw error;

        alert("Package request rejected.");

        await loadAdminPackageRequests();

    } catch (error) {
        alert("Package rejection failed: " + error.message);
    }
};

$("refreshPackages")?.addEventListener(
    "click",
    loadAdminPackageRequests
);

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
// SUPPORT MESSAGES
// ======================================

async function loadAdminSupportMessages() {
    if (!adminVerified) return;

    const container = $("adminSupportMessages");
    if (!container) return;

    container.textContent = "Loading support messages...";

    try {
        const { data, error } = await db
            .from("support_messages")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        if (!data?.length) {
            container.textContent = "No support messages yet.";
            return;
        }

        container.innerHTML = data.map(item => `
            <article class="card">
                <h3>Support Request #${item.id}</h3>

                <p><strong>User ID:</strong>
                    ${escapeHTML(item.user_id)}
                </p>

                <p><strong>Message:</strong></p>
                <p>${escapeHTML(item.message)}</p>

                <p><strong>Status:</strong>
                    ${escapeHTML(item.status)}
                </p>

                ${
                    item.admin_reply
                    ? `
                        <p><strong>Your Reply:</strong></p>
                        <p>${escapeHTML(item.admin_reply)}</p>
                    `
                    : ""
                }

                <textarea
                    id="supportReply${item.id}"
                    rows="3"
                    placeholder="Write your reply..."
                >${escapeHTML(item.admin_reply || "")}</textarea>

                <button onclick="adminReplySupport(${item.id})">
                    Send Reply
                </button>
            </article>
        `).join("");

    } catch (error) {
        console.error("Support messages error:", error);
        container.textContent =
            "Could not load messages: " + error.message;
    }
}

window.adminReplySupport = async function(id) {
    if (!adminVerified) return;

    const textarea = $("supportReply" + id);
    const reply = textarea?.value.trim();

    if (!reply) {
        alert("Please write a reply first.");
        return;
    }

    try {
        const { error } = await db
            .from("support_messages")
            .update({
                admin_reply: reply,
                status: "replied",
                replied_at: new Date().toISOString()
            })
            .eq("id", id);

        if (error) throw error;

        alert("Reply sent successfully!");

        await loadAdminSupportMessages();

    } catch (error) {
        alert("Reply failed: " + error.message);
    }
};

$("refreshSupport")?.addEventListener(
    "click",
    loadAdminSupportMessages
);

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
// PACKAGE REWARD FUNDING
// ======================================

async function loadAdminPackageFunding() {
    const historyBox = $("packageFundingHistory");

    try {
        const [fundingResult, rewardsResult] = await Promise.all([
            db.from("package_reward_funding")
                .select("id, amount, source, reference_note, status, created_at")
                .order("created_at", { ascending: false }),

            db.from("package_reward_history")
                .select("amount")
        ]);

        if (fundingResult.error) throw fundingResult.error;
        if (rewardsResult.error) throw rewardsResult.error;

        const fundingRows = fundingResult.data || [];
        const rewardRows = rewardsResult.data || [];

        const totalFunding = fundingRows
            .filter(item => item.status === "approved")
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);

        const totalRewards = rewardRows
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);

        const availableFunding = totalFunding - totalRewards;

        $("totalPackageFunding").textContent =
            "Rs. " + totalFunding.toFixed(2);

        $("totalPackageRewards").textContent =
            "Rs. " + totalRewards.toFixed(2);

        $("availablePackageFunding").textContent =
            "Rs. " + availableFunding.toFixed(2);

        if (!fundingRows.length) {
            historyBox.innerHTML = "<p>No funding records found.</p>";
            return;
        }

        historyBox.innerHTML = `
            <h3>Funding History</h3>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Amount</th>
                            <th>Source</th>
                            <th>Reference</th>
                            <th>Status</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${fundingRows.map(item => `
                            <tr>
                                <td>Rs. ${Number(item.amount).toFixed(2)}</td>
                                <td>${escapeHTML(item.source)}</td>
                                <td>${escapeHTML(item.reference_note || "—")}</td>
                                <td>${escapeHTML(item.status.toUpperCase())}</td>
                                <td>${new Date(item.created_at).toLocaleString()}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        `;

    } catch (error) {
        console.error("Package funding error:", error);
        historyBox.innerHTML =
            `<p>Could not load funding: ${escapeHTML(error.message)}</p>`;
    }
}

// ADD VERIFIED FUNDING
$("packageFundingForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!adminVerified) {
        alert("Administrator verification required.");
        return;
    }

    const amount = Number($("packageFundingAmount").value);
    const source = $("packageFundingSource").value.trim();
    const reference = $("packageFundingReference").value.trim();
    const button = $("addPackageFundingButton");

    if (!Number.isFinite(amount) || amount <= 0 || !source || !reference) {
        alert("Enter a valid amount, funding source, and verification reference.");
        return;
    }

    if (!confirm(
        "Confirm that Rs. " + amount.toFixed(2) +
        " has actually been received and verified?"
    )) return;

    button.disabled = true;

    try {
        const { error } = await db.rpc("add_package_reward_funding", {
            p_amount: amount,
            p_source: source,
            p_reference_note: reference
        });

        if (error) throw error;

        alert("Verified package funding added successfully!");

        $("packageFundingForm").reset();
        await loadAdminPackageFunding();

    } catch (error) {
        alert("Could not add funding: " + error.message);
    } finally {
        button.disabled = false;
    }
});

// REFRESH FUNDING
$("refreshPackageFunding")?.addEventListener(
    "click",
    loadAdminPackageFunding
);

// ======================================
// REFRESH DASHBOARD
// ======================================

async function refreshAdminDashboard() {
    if (!adminVerified) return;

await Promise.all([
    loadAdminAnalytics(),
    loadAdminSubmissions(),
    loadAdminWithdrawals(),
    loadAdminDeposits(),
    loadAdminPackageRequests(),
    loadAdminSponsoredCampaigns(),
    loadAdminPackageFunding(),
    loadPlatformChart(),
    loadAdminSupportMessages()
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
