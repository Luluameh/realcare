// RealCare: Proactive Family Care & Empathetic Recall Companion Logic
document.addEventListener("DOMContentLoaded", () => {
  // Global API base resolution (works on file://, live server, and localhost:8000)
  const API_BASE = (window.location.protocol === "file:" || !window.location.host.includes(":8000"))
    ? "http://127.0.0.1:8000"
    : "";

  const _origFetch = window.fetch;
  window.fetch = function(input, init) {
    if (typeof input === "string" && input.startsWith("/api/")) {
      input = API_BASE + input;
    }
    return _origFetch(input, init);
  };

  // Application State
  let circleData = [];
  let draftsData = [];
  let familyData = [];
  let notifsData = [];
  let activePersonId = null;
  let currentFilter = "all";
  let activeMobileTab = "circle";

  // Elements: Navigation & Counts
  const circleList = document.getElementById("circleList");
  const mainWorkspace = document.getElementById("mainWorkspace");
  const countAll = document.getElementById("countAll");
  const countOverdue = document.getElementById("countOverdue");
  const countRecent = document.getElementById("countRecent");
  const mobCountOverdue = document.getElementById("mobCountOverdue");
  const healthScorePercent = document.getElementById("healthScorePercent");
  const healthScoreFill = document.getElementById("healthScoreFill");
  const healthTipText = document.getElementById("healthTipText");
  const agentStatusText = document.getElementById("agentStatusText");

  // Elements: Notifications
  const btnNotifCenter = document.getElementById("btnNotifCenter");
  const notifBadge = document.getElementById("notifBadge");
  const mobNotifCount = document.getElementById("mobNotifCount");
  const notifDrawer = document.getElementById("notifDrawer");
  const drawerBackdrop = document.getElementById("drawerBackdrop");
  const btnCloseNotifDrawer = document.getElementById("btnCloseNotifDrawer");
  const drawerNotifList = document.getElementById("drawerNotifList");
  const drawerUnreadLabel = document.getElementById("drawerUnreadLabel");
  const btnMarkAllRead = document.getElementById("btnMarkAllRead");
  const btnTestDispatch = document.getElementById("btnTestDispatch");
  const btnTogglePush = document.getElementById("btnTogglePush");
  const pushStatusText = document.getElementById("pushStatusText");

  // Elements: Mobile Tab Switcher
  const sidebarPanel = document.getElementById("sidebarPanel");
  const mobileNavTabs = document.getElementById("mobileNavTabs");
  const mobTabCircle = document.getElementById("mobTabCircle");
  const mobTabWorkspace = document.getElementById("mobTabWorkspace");
  const mobTabAlerts = document.getElementById("mobTabAlerts");

  // Filters
  const filterTabs = document.querySelectorAll(".filter-tab");
  filterTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      filterTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentFilter = tab.dataset.filter;
      renderCircleList();
    });
  });

  // Global Actions
  const btnGlobalScan = document.getElementById("btnGlobalScan");
  const btnResetData = document.getElementById("btnResetData");

  if (btnGlobalScan) btnGlobalScan.addEventListener("click", handleGlobalScan);
  if (btnResetData) btnResetData.addEventListener("click", handleResetData);

  // Modals
  const modalAddPerson = document.getElementById("modalAddPerson");
  const btnOpenAddPerson = document.getElementById("btnOpenAddPerson");
  const btnCloseAddPerson = document.getElementById("btnCloseAddPerson");
  const btnCancelAddPerson = document.getElementById("btnCancelAddPerson");
  const formAddPerson = document.getElementById("formAddPerson");

  if (btnOpenAddPerson) {
    btnOpenAddPerson.addEventListener("click", () => {
      document.getElementById("personLastContact").value = new Date().toISOString().split("T")[0];
      modalAddPerson.classList.add("open");
    });
  }
  if (btnCloseAddPerson) btnCloseAddPerson.addEventListener("click", () => modalAddPerson.classList.remove("open"));
  if (btnCancelAddPerson) btnCancelAddPerson.addEventListener("click", () => modalAddPerson.classList.remove("open"));

  const modalAddFact = document.getElementById("modalAddFact");
  const btnCloseAddFact = document.getElementById("btnCloseAddFact");
  const btnCancelAddFact = document.getElementById("btnCancelAddFact");
  const formAddFact = document.getElementById("formAddFact");

  if (btnCloseAddFact) btnCloseAddFact.addEventListener("click", () => modalAddFact.classList.remove("open"));
  if (btnCancelAddFact) btnCancelAddFact.addEventListener("click", () => modalAddFact.classList.remove("open"));

  const modalLogFamily = document.getElementById("modalLogFamily");
  const btnCloseLogFamily = document.getElementById("btnCloseLogFamily");
  const btnCancelLogFamily = document.getElementById("btnCancelLogFamily");
  const formLogFamily = document.getElementById("formLogFamily");

  if (btnCloseLogFamily) btnCloseLogFamily.addEventListener("click", () => modalLogFamily.classList.remove("open"));
  if (btnCancelLogFamily) btnCancelLogFamily.addEventListener("click", () => modalLogFamily.classList.remove("open"));

  // Form Submissions
  if (formAddPerson) formAddPerson.addEventListener("submit", handleAddPersonSubmit);
  if (formAddFact) formAddFact.addEventListener("submit", handleAddFactSubmit);
  if (formLogFamily) formLogFamily.addEventListener("submit", handleLogFamilySubmit);

  // Notification Drawer Listeners
  if (btnNotifCenter) btnNotifCenter.addEventListener("click", openNotifDrawer);
  if (btnCloseNotifDrawer) btnCloseNotifDrawer.addEventListener("click", closeNotifDrawer);
  if (drawerBackdrop) drawerBackdrop.addEventListener("click", closeNotifDrawer);
  if (btnMarkAllRead) btnMarkAllRead.addEventListener("click", handleMarkAllNotificationsRead);
  if (btnTestDispatch) btnTestDispatch.addEventListener("click", handleTriggerTestAlert);
  if (btnTogglePush) btnTogglePush.addEventListener("click", handleRequestPushPermission);

  // Mobile Tab Listeners
  if (mobTabCircle && mobTabWorkspace && mobTabAlerts) {
    mobTabCircle.addEventListener("click", () => switchMobileView("circle"));
    mobTabWorkspace.addEventListener("click", () => switchMobileView("workspace"));
    mobTabAlerts.addEventListener("click", () => {
      openNotifDrawer();
    });
  }

  function switchMobileView(view) {
    activeMobileTab = view;
    if (view === "circle") {
      mobTabCircle.classList.add("active");
      mobTabWorkspace.classList.remove("active");
      sidebarPanel.classList.remove("mobile-hidden");
      mainWorkspace.classList.add("mobile-hidden");
    } else {
      mobTabWorkspace.classList.add("active");
      mobTabCircle.classList.remove("active");
      sidebarPanel.classList.add("mobile-hidden");
      mainWorkspace.classList.remove("mobile-hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // --- Web Audio Synthesizer Chime ---
  function playChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const now = ctx.currentTime;
      // Soft gentle two-tone chime (D5 -> A5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0.08, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.6);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, now + 0.12); // A5
      gain2.gain.setValueAtTime(0.09, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.9);
    } catch (e) {
      // Audio not permitted or supported; ignore silently
    }
  }

  // --- Browser Native Push Notifications ---
  function checkPushSupport() {
    if (!pushStatusText || !btnTogglePush) return;
    if (!("Notification" in window)) {
      pushStatusText.textContent = "Not supported in this browser";
      btnTogglePush.disabled = true;
      btnTogglePush.textContent = "Unsupported";
      return;
    }

    if (Notification.permission === "granted") {
      pushStatusText.textContent = "Desktop notifications active";
      btnTogglePush.textContent = "Active";
      btnTogglePush.classList.add("channel-status", "active");
    } else if (Notification.permission === "denied") {
      pushStatusText.textContent = "Blocked in browser settings";
      btnTogglePush.textContent = "Blocked";
    } else {
      pushStatusText.textContent = "Click to enable desktop alerts";
      btnTogglePush.textContent = "Enable";
    }
  }

  async function handleRequestPushPermission() {
    if (!("Notification" in window)) {
      showToast("Web Notifications not supported in this browser", `<i class="ri-alert-line"></i>`);
      return;
    }
    if (Notification.permission === "granted") {
      showToast("Desktop alerts are already active!", `<i class="ri-notification-3-line"></i>`);
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      checkPushSupport();
      if (permission === "granted") {
        playChime();
        new Notification("RealCare Alerts Activated", {
          body: "You will receive proactive care alerts when loved ones are overdue.",
          icon: "/static/favicon.ico"
        });
        showToast("Desktop alerts enabled!", `<i class="ri-notification-3-line"></i>`);
      } else {
        showToast("Notification permission dismissed or denied", `<i class="ri-information-line"></i>`);
      }
    } catch (err) {
      console.error(err);
    }
  }

  function dispatchDesktopNotification(title, message, personId = null) {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        const notif = new Notification(title, {
          body: message
        });
        notif.onclick = () => {
          window.focus();
          if (personId) {
            window.selectPerson(personId);
          }
          closeNotifDrawer();
        };
      } catch (e) {
        console.error(e);
      }
    }
  }

  // --- Notification Drawer Control ---
  function openNotifDrawer() {
    if (notifDrawer) notifDrawer.classList.add("open");
    if (drawerBackdrop) drawerBackdrop.classList.add("open");
    fetchNotifications();
  }

  function closeNotifDrawer() {
    if (notifDrawer) notifDrawer.classList.remove("open");
    if (drawerBackdrop) drawerBackdrop.classList.remove("open");
  }

  // --- Initial Data Fetching ---
  async function loadInitialData() {
    try {
      fetch("/api/health")
        .then(r => r.json())
        .then(h => {
          if (h && h.mode_label && agentStatusText) {
            agentStatusText.textContent = h.mode_label;
          }
        })
        .catch(() => {});

      checkPushSupport();

      await Promise.all([
        fetchCircle(),
        fetchDrafts(),
        fetchFamilyView(),
        fetchNotifications()
      ]);

      if (circleData.length > 0) {
        const defaultPerson = circleData.find(p => p.id === "eleanor-vance") || circleData[0];
        activePersonId = defaultPerson.id;
        renderCircleList();
        renderWorkspace();
      }
    } catch (err) {
      console.error("Error loading data:", err);
      showToast("Could not connect to RealCare backend", `<i class="ri-alert-line"></i>`);
    }
  }

  async function fetchCircle() {
    const res = await fetch("/api/circle");
    circleData = await res.json();
    updateHealthMetrics();
  }

  async function fetchDrafts() {
    const res = await fetch("/api/drafts?status=pending");
    draftsData = await res.json();
  }

  async function fetchFamilyView() {
    const res = await fetch("/api/family-view/eleanor-vance");
    const data = await res.json();
    familyData = data.checkins || [];
  }

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      notifsData = data.notifications || [];
      updateNotificationBadges(data.unread_count || 0);
      renderNotifications();
    } catch (e) {
      console.error("Failed to load notifications:", e);
    }
  }

  function updateNotificationBadges(unreadCount) {
    if (notifBadge) {
      if (unreadCount > 0) {
        notifBadge.textContent = unreadCount;
        notifBadge.classList.remove("zero");
      } else {
        notifBadge.textContent = "0";
        notifBadge.classList.add("zero");
      }
    }
    if (mobNotifCount) mobNotifCount.textContent = unreadCount || "0";
    if (drawerUnreadLabel) {
      drawerUnreadLabel.textContent = `${unreadCount} Unread Alert${unreadCount === 1 ? '' : 's'}`;
    }
  }

  function updateHealthMetrics() {
    const total = circleData.length;
    const overdue = circleData.filter(p => p.is_overdue).length;
    const recent = total - overdue;
    const health = total > 0 ? Math.round((recent / total) * 100) : 100;

    if (countAll) countAll.textContent = total;
    if (countOverdue) countOverdue.textContent = overdue;
    if (countRecent) countRecent.textContent = recent;
    if (mobCountOverdue) mobCountOverdue.textContent = overdue;

    if (healthScorePercent) healthScorePercent.textContent = `${health}%`;
    if (healthScoreFill) {
      healthScoreFill.style.width = `${health}%`;
      if (overdue === 0) {
        healthScoreFill.style.background = "linear-gradient(90deg, #10b981 0%, #059669 100%)";
      } else {
        healthScoreFill.style.background = health < 50
          ? "linear-gradient(90deg, #ef4444 0%, #dc2626 100%)"
          : "linear-gradient(90deg, #f59e0b 0%, #d97736 100%)";
      }
    }

    if (healthTipText) {
      if (overdue === 0) {
        healthTipText.textContent = "Everyone in your circle has been reached out to recently!";
      } else {
        healthTipText.textContent = `${overdue} ${overdue === 1 ? 'person is' : 'people are'} overdue for a gentle connection.`;
      }
    }
  }

  // --- Render Left Sidebar ---
  function renderCircleList() {
    if (!circleList) return;
    let filtered = circleData;
    if (currentFilter === "overdue") {
      filtered = circleData.filter(p => p.is_overdue);
    } else if (currentFilter === "recent") {
      filtered = circleData.filter(p => !p.is_overdue);
    }

    if (filtered.length === 0) {
      circleList.innerHTML = `
        <div style="text-align: center; padding: 36px 12px; color: var(--text-muted); font-size: 13px;">
          No loved ones match this filter.
        </div>
      `;
      return;
    }

    circleList.innerHTML = filtered.map(person => {
      const initials = person.name.split(" ").map(n => n[0]).join("").slice(0, 2);
      const isActive = person.id === activePersonId;
      const hasDraft = draftsData.some(d => d.person_id === person.id);
      
      const badge = person.is_overdue
        ? `<span class="badge-overdue-soft">Overdue ${person.days_overdue}d</span>`
        : `<span class="badge-recent-soft">Every ${person.checkin_frequency_days}d</span>`;

      const draftIcon = hasDraft
        ? `<span title="Draft pending review" style="line-height:1;"><i class="ri-mail-heart-line" style="font-size:13px;color:var(--emerald);"></i></span>`
        : '';

      return `
        <div class="circle-item ${isActive ? 'active' : ''}" onclick="window.selectPerson('${person.id}')">
          <div class="circle-item-avatar" style="background: ${person.avatar_color || '#2d6a4f'};">
            ${initials}
          </div>
          <div class="circle-item-details">
            <div class="circle-item-top">
              <span class="circle-item-name">${escapeHtml(person.name)}</span>
              ${draftIcon}
            </div>
            <span class="circle-item-rel">${escapeHtml(person.relationship)}</span>
            <div class="circle-item-bottom">
              ${badge}
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  // --- Render Right Workspace ---
  function renderWorkspace() {
    if (!mainWorkspace) return;
    const person = circleData.find(p => p.id === activePersonId);
    if (!person) {
      mainWorkspace.innerHTML = `
        <div class="workspace-section" style="text-align: center; padding: 60px 20px;">
          <h3 style="font-family: var(--font-display); font-size: 20px; margin-bottom: 8px;">No Loved One Selected</h3>
          <p style="color: var(--text-muted); font-size: 13px;">Choose someone from your care circle on the left to see memory anchors, care context, and drafted check-ins.</p>
        </div>
      `;
      return;
    }

    const initials = person.name.split(" ").map(n => n[0]).join("").slice(0, 2);
    const draft = draftsData.find(d => d.person_id === person.id);
    const isMemoryCare = person.id === "eleanor-vance" || (person.notes && person.notes.toLowerCase().includes("memory")) || (person.notes && person.notes.toLowerCase().includes("cognitive"));

    // Memory anchors HTML
    const anchorsHtml = (person.facts && person.facts.length > 0)
      ? person.facts.map(f => {
          const cat = f.category || 'interest';
          return `
            <div class="anchor-card">
              <span class="anchor-badge badge-cat-${cat}">${formatCategory(cat)}</span>
              <p class="anchor-content">${escapeHtml(f.content)}</p>
            </div>
          `;
        }).join("")
      : `<p style="color: var(--text-muted); font-size: 13px; padding: 12px 0;">No memory anchors stored yet. Add a favorite hobby, routine, or cherished story!</p>`;

    // Check-in Studio HTML
    let draftStudioHtml = "";
    if (draft) {
      draftStudioHtml = `
        <div class="draft-active-card">
          <div class="draft-reasoning">
            <div class="draft-reasoning-title">
              <i class="ri-sparkling-2-line"></i> Strands Agent Reasoning
            </div>
            ${escapeHtml(draft.reasoning)}
          </div>

          <div class="draft-message-field">
            <label>Grounded Message Draft (Review or edit before sending):</label>
            <textarea class="draft-message-input" id="draftInput-${draft.id}" rows="4">${escapeHtml(draft.message)}</textarea>
          </div>

          <div class="draft-actions-row">
            <button class="btn-discard" onclick="window.handleRejectDraft('${draft.id}')">
              <i class="ri-delete-bin-line"></i> Discard
            </button>
            <button class="btn-warm" onclick="window.handleApproveDraft('${draft.id}')">
              <i class="ri-send-plane-line"></i> Approve &amp; Send (Simulated)
            </button>
          </div>
        </div>
      `;
    } else {
      draftStudioHtml = `
        <div class="draft-empty-state">
          <i class="ri-mail-star-line draft-empty-icon"></i>
          <h4>No Draft In Review</h4>
          <p>The RealCare Recall Agent crafts authentic messages grounded in ${escapeHtml(person.name)}'s stored memories.</p>
          <button class="btn-warm" onclick="window.handleDraftMessage('${person.id}')">
            <i class="ri-magic-line"></i> Craft Personalized Check-in
          </button>
        </div>
      `;
    }

    // Shared Family Care Circle HTML (for memory care loved ones)
    const COORD_COLORS = ['#00a870','#7c5cbf','#d4881a','#3b82f6','#e04060','#0891b2'];
    function coordColor(name) {
      let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xFFFFFF;
      return COORD_COLORS[Math.abs(h) % COORD_COLORS.length];
    }
    function contactTypeIcon(type) {
      if (!type) return 'ri-chat-3-line';
      const t = type.toLowerCase();
      if (t.includes('phone')) return 'ri-phone-line';
      if (t.includes('video')) return 'ri-vidicon-line';
      if (t.includes('visit') || t.includes('person')) return 'ri-walk-line';
      if (t.includes('package') || t.includes('letter')) return 'ri-gift-line';
      return 'ri-chat-3-line';
    }

    let familyCircleHtml = "";
    if (isMemoryCare) {
      const membersSet = new Set(familyData.map(c => c.member_name));

      const coordCards = familyData.map(c => {
        const av = (c.member_name || '?').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
        const color = coordColor(c.member_name || 'X');
        const icon  = contactTypeIcon(c.contact_type);
        return `
          <div class="care-coord-card">
            <div class="care-coord-av" style="background:${color}">${av}</div>
            <div class="care-coord-body">
              <div class="care-coord-top">
                <span class="care-coord-name">${escapeHtml(c.member_name)}</span>
                <span class="care-coord-type-pill"><i class="${icon}"></i> ${escapeHtml(c.contact_type)}</span>
              </div>
              <p class="care-coord-note">${escapeHtml(c.summary_note)}</p>
              <div class="care-coord-meta">
                <span class="care-coord-meta-item"><i class="ri-calendar-check-line"></i>${c.last_contact_date}</span>
                <span class="care-coord-meta-item"><i class="ri-time-line"></i>${timeAgo(c.last_contact_date ? c.last_contact_date + 'T09:00:00' : new Date().toISOString())}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');

      familyCircleHtml = `
        <div class="workspace-section">
          <div class="section-header-row">
            <div class="section-title-group">
              <div class="section-icon-wrap violet"><i class="ri-home-heart-line"></i></div>
              <div>
                <h3 class="section-title">Shared Family Care Circle</h3>
                <p class="section-desc">Care and emotional touchpoints coordinated across the whole family.</p>
              </div>
            </div>
            <button class="btn-ghost" onclick="window.openLogFamilyModal()">
              <i class="ri-add-line"></i> Log Check-in
            </button>
          </div>

          <!-- Care Coordination Stats Strip -->
          <div class="care-coord-stats-strip">
            <div class="coord-stat-item">
              <i class="ri-group-line"></i>
              <div><span class="coord-stat-val">${membersSet.size}</span><span class="coord-stat-label">Family members active</span></div>
            </div>
            <div class="coord-stat-item">
              <i class="ri-calendar-check-line"></i>
              <div><span class="coord-stat-val">${familyData.length}</span><span class="coord-stat-label">Touchpoints logged</span></div>
            </div>
            <div class="coord-stat-item">
              <i class="ri-heart-line"></i>
              <div><span class="coord-stat-val">Active</span><span class="coord-stat-label">Care coordination</span></div>
            </div>
          </div>

          <!-- Memory Care Tips -->
          <div class="care-tips-card">
            <div class="care-tips-header">
              <i class="ri-lightbulb-flash-line"></i>
              Memory-Friendly Connection Tips for ${escapeHtml(person.name)}
            </div>
            <div class="care-tips-list">
              <div class="care-tip">
                <div class="care-tip-dot"></div>
                <span><strong style="color:var(--text-primary)">Anchor in sensory comfort:</strong> Bring up familiar joys &mdash; hobbies, garden details, or favorite routines.</span>
              </div>
              <div class="care-tip">
                <div class="care-tip-dot"></div>
                <span><strong style="color:var(--text-primary)">Introduce yourself warmly:</strong> Never quiz their memory. Greet with affection: <em style="color:var(--emerald)">&ldquo;Hi ${escapeHtml(person.name)}, it&rsquo;s Maya &mdash; thinking of you today!&rdquo;</em></span>
              </div>
              <div class="care-tip">
                <div class="care-tip-dot"></div>
                <span><strong style="color:var(--text-primary)">Consistent morning rhythm:</strong> Older adults are typically most alert mid-morning. Aim for calls in that window.</span>
              </div>
            </div>
          </div>

          <!-- Care Coordination Cards -->
          <div class="care-coord-cards">
            ${coordCards || '<div class="care-coord-empty"><i class="ri-hand-heart-line"></i><h4>No touchpoints yet</h4><p>Log the first family check-in to get started.</p></div>'}
          </div>
        </div>
      `;
    }

    // Proactive Autonomous Heartbeat & Notification Architecture Console (renders at bottom of workspace for all contacts)
    const daysRemaining = person.checkin_frequency_days - person.days_since_contact;
    const heartbeatStatusBadge = person.is_overdue
      ? `<span class="badge-overdue-soft"><i class="ri-alarm-warning-line"></i> Alert Active &middot; Overdue ${person.days_overdue} Days</span>`
      : `<span class="badge-recent-soft"><i class="ri-shield-check-line"></i> Schedule Healthy &middot; ${daysRemaining > 0 ? daysRemaining + 'd remaining' : 'Due today'}</span>`;

    const heartbeatConsoleHtml = `
      <div class="proactive-heartbeat-card">
        <div class="heartbeat-header-row">
          <div class="heartbeat-title-group">
            <div class="section-icon-wrap emerald"><i class="ri-radar-line pulse-icon"></i></div>
            <div>
              <h4>Autonomous Care Heartbeat &amp; Alert Engine</h4>
              <p class="heartbeat-subtext">Continuous Strands agent daemon monitors touchpoints and prevents loved ones from drifting away.</p>
            </div>
          </div>
          <div>${heartbeatStatusBadge}</div>
        </div>

        <!-- Metrics Grid -->
        <div class="heartbeat-metrics-grid">
          <div class="heartbeat-metric-box">
            <div class="heartbeat-metric-label"><i class="ri-timer-line"></i> Care Rhythm</div>
            <div class="heartbeat-metric-val">Every ${person.checkin_frequency_days} Days</div>
          </div>
          <div class="heartbeat-metric-box">
            <div class="heartbeat-metric-label"><i class="ri-calendar-event-line"></i> Last Contact</div>
            <div class="heartbeat-metric-val">${person.days_since_contact} days ago (${person.last_contact_date})</div>
          </div>
          <div class="heartbeat-metric-box">
            <div class="heartbeat-metric-label"><i class="ri-broadcast-line"></i> Preferred Channel</div>
            <div class="heartbeat-metric-val">${person.preferred_channel}</div>
          </div>
        </div>

        <!-- Triple Channel Delivery Indicators -->
        <div class="heartbeat-channels-strip">
          <div class="heartbeat-channel-item">
            <div class="heartbeat-channel-icon emerald"><i class="ri-volume-up-line"></i></div>
            <div>
              <span class="heartbeat-channel-name">In-App Chime &amp; Live Popup</span>
              <span class="heartbeat-channel-state">Web Audio Synthesizer &middot; Active</span>
            </div>
          </div>
          <div class="heartbeat-channel-item">
            <div class="heartbeat-channel-icon amber"><i class="ri-computer-line"></i></div>
            <div>
              <span class="heartbeat-channel-name">Desktop Web Push</span>
              <span class="heartbeat-channel-state">OS-Level Native Alert &middot; Supported</span>
            </div>
          </div>
          <div class="heartbeat-channel-item">
            <div class="heartbeat-channel-icon violet"><i class="ri-chat-3-line"></i></div>
            <div>
              <span class="heartbeat-channel-name">SMS / WhatsApp Webhook</span>
              <span class="heartbeat-channel-state">Twilio Gateway Simulation &middot; Armed</span>
            </div>
          </div>
        </div>

        <!-- Interactive Live Test Action Bar -->
        <div class="heartbeat-action-bar">
          <div class="heartbeat-explainer">
            <i class="ri-lightbulb-flash-line"></i>
            <span>Test how notifications look, sound, and deliver for <strong>${escapeHtml(person.name)}</strong>:</span>
          </div>
          <button class="btn-warm" onclick="window.handleTriggerPersonAlert('${person.id}')">
            <i class="ri-broadcast-line"></i> Dispatch Live Alert for ${escapeHtml(person.name)}
          </button>
        </div>
      </div>
    `;

    mainWorkspace.innerHTML = `
      <!-- Hero Person Profile Card -->
      <div class="person-hero-card">
        <div class="hero-profile-info">
          <div class="hero-avatar" style="background: ${person.avatar_color || '#2d6a4f'};">
            <div class="hero-avatar-ring"></div>
            ${initials}
          </div>
          <div class="hero-text">
            <h2>${escapeHtml(person.name)}</h2>
            <div class="hero-meta-row">
              <span class="hero-rel-pill">${escapeHtml(person.relationship)}</span>
              <span style="color:var(--text-muted);font-size:12px;">&middot; Every <strong style="color:var(--text-secondary)">${person.checkin_frequency_days}d</strong></span>
              <span style="color:var(--text-muted);font-size:12px;">&middot; ${person.preferred_channel}</span>
              <span class="${person.is_overdue ? 'badge-overdue-soft' : 'badge-recent-soft'}">
                ${person.is_overdue ? `Overdue ${person.days_overdue}d` : `In touch &middot; ${person.days_since_contact}d ago`}
              </span>
            </div>
          </div>
        </div>

        <div class="hero-actions">
          <button class="btn-contact-quick" onclick="window.handleRecordContact('${person.id}')" title="Reset contact timer to today">
            <i class="ri-check-line"></i> Mark Contacted
          </button>
          <button class="btn-warm" onclick="window.handleDraftMessage('${person.id}')">
            <i class="ri-magic-line"></i> Draft with Agent
          </button>
        </div>
      </div>

      ${person.notes ? `
        <div class="care-context-box">
          <div class="section-icon-wrap emerald"><i class="ri-compass-3-line"></i></div>
          <div>
            <div class="care-context-title">Care &amp; Communication Context</div>
            <div>${escapeHtml(person.notes)}</div>
          </div>
        </div>
      ` : ''}

      <!-- Memory Anchors Section -->
      <div class="workspace-section">
        <div class="section-header-row">
          <div class="section-title-group">
            <div class="section-icon-wrap amber"><i class="ri-mind-map"></i></div>
            <div>
              <h3 class="section-title">Memory &amp; Connection Anchors</h3>
              <p class="section-desc">Authentic stories, passions, and routines that keep connection warm and meaningful.</p>
            </div>
          </div>
          <button class="btn-ghost" onclick="window.openAddFactModal('${person.id}', '${escapeAttr(person.name)}')">
            <i class="ri-add-line"></i> Add Anchor
          </button>
        </div>

        <div class="anchors-grid">
          ${anchorsHtml}
        </div>
      </div>

      <!-- Agent Check-in Studio Section -->
      <div class="workspace-section">
        <div class="section-header-row">
          <div class="section-title-group">
            <div class="section-icon-wrap emerald"><i class="ri-sparkling-2-line"></i></div>
            <div>
              <h3 class="section-title">Strands Agent Check-in Studio</h3>
              <p class="section-desc">Empathetic, memory-grounded drafts with Human-in-the-Loop review.</p>
            </div>
          </div>
          ${draft ? '<span class="badge-overdue-soft">Awaiting Review</span>' : ''}
        </div>

        <div class="draft-studio-wrap">
          ${draftStudioHtml}
        </div>
      </div>

      <!-- Shared Family Alignment View (for memory care) -->
      ${familyCircleHtml}

      <!-- Proactive Autonomous Heartbeat & Multi-Channel Notification Console (Bottom Section) -->
      ${heartbeatConsoleHtml}
    `;
  }

  // --- Render Notification Center List ---
  function renderNotifications() {
    if (!drawerNotifList) return;

    if (notifsData.length === 0) {
      drawerNotifList.innerHTML = `
        <div style="text-align: center; padding: 40px 16px; color: var(--text-muted); font-size: 13px;">
          <div style="font-size: 28px; margin-bottom: 8px;"><i class="ri-checkbox-circle-line" style="color:var(--emerald);"></i></div>
          <strong>All caught up!</strong>
          <p style="margin-top: 4px;">No active care alerts at this moment.</p>
        </div>
      `;
      return;
    }

    drawerNotifList.innerHTML = notifsData.map(n => {
      const isUnread = !n.is_read;
      const urgencyClass = n.urgency === "high" ? "urgency-high" : n.urgency === "medium" ? "urgency-medium" : "urgency-info";
      const pillClass = n.urgency === "high" ? "pill-high" : n.urgency === "medium" ? "pill-medium" : "pill-info";
      const pillText = n.urgency === "high" ? "Urgent Alert" : n.urgency === "medium" ? "Reminder" : "Family Touchpoint";

      return `
        <div class="notif-card ${urgencyClass} ${isUnread ? 'unread' : ''}">
          <div class="notif-top">
            <span class="notif-title">${escapeHtml(n.title)}</span>
            <span class="notif-badge-pill ${pillClass}">${pillText}</span>
          </div>
          <p class="notif-message">${escapeHtml(n.message)}</p>
          <div class="notif-footer">
            <span class="notif-time">${escapeHtml(n.channel)} &bull; ${timeAgo(n.created_at)}</span>
            <div class="notif-actions">
              ${n.person_id ? `
                <button class="btn-notif-action" onclick="window.handleNotifReview('${n.id}', '${n.person_id}')">
                  Review
                </button>
              ` : ''}
              ${isUnread ? `
                <button class="btn-notif-action" onclick="window.handleMarkNotifRead('${n.id}')">
                  Mark Read
                </button>
              ` : ''}
              <button class="btn-notif-action" onclick="window.handleDismissNotif('${n.id}')" title="Dismiss">
                &times;
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function formatCategory(cat) {
    const map = {
      memory: "Cherished Memory",
      interest: "Passion / Hobby",
      routine: "Daily Comfort",
      topic: "Recent Topic",
      life_update: "Life Update"
    };
    return map[cat] || "Anchor";
  }

  function timeAgo(dateStr) {
    try {
      const past = new Date(dateStr).getTime();
      const now = Date.now();
      const diffMin = Math.round((now - past) / 60000);
      if (diffMin < 2) return "Just now";
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.round(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.round(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return "Recently";
    }
  }

  // --- Window Global Handlers ---
  window.selectPerson = function(id) {
    activePersonId = id;
    renderCircleList();
    renderWorkspace();
    if (window.innerWidth <= 960) {
      switchMobileView("workspace");
    }
  };

  window.openAddFactModal = function(id, name) {
    document.getElementById("addFactPersonId").value = id;
    document.getElementById("addFactPersonName").textContent = name;
    modalAddFact.classList.add("open");
  };

  window.openLogFamilyModal = function() {
    modalLogFamily.classList.add("open");
  };

  window.handleDraftMessage = async function(personId) {
    showToast("Strands Agent is crafting an empathetic draft...", `<i class="ri-sparkling-2-line"></i>`);
    try {
      const res = await fetch(`/api/agent/draft/${personId}`, { method: "POST" });
      if (!res.ok) throw new Error("Draft failed");
      await fetchDrafts();
      renderCircleList();
      renderWorkspace();
      playChime();
      showToast("Personalized draft ready for review!", `<i class="ri-check-line"></i>`);
    } catch (err) {
      console.error(err);
      showToast("Drafting error", `<i class="ri-alert-line"></i>`);
    }
  };

  window.handleApproveDraft = async function(draftId) {
    const input = document.getElementById(`draftInput-${draftId}`);
    const editedMsg = input ? input.value : null;

    try {
      const res = await fetch(`/api/drafts/${draftId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edited_message: editedMsg })
      });
      await Promise.all([fetchCircle(), fetchDrafts()]);
      renderCircleList();
      renderWorkspace();
      playChime();
      showToast("Message sent! Contact timer reset.", `<i class="ri-send-plane-line"></i>`);
    } catch (err) {
      console.error(err);
      showToast("Approval failed", `<i class="ri-alert-line"></i>`);
    }
  };

  window.handleRejectDraft = async function(draftId) {
    try {
      await fetch(`/api/drafts/${draftId}/reject`, { method: "POST" });
      await fetchDrafts();
      renderCircleList();
      renderWorkspace();
      showToast("Draft discarded", `<i class="ri-delete-bin-line"></i>`);
    } catch (err) {
      console.error(err);
    }
  };

  window.handleRecordContact = async function(personId) {
    try {
      await fetch(`/api/circle/${personId}/contact`, { method: "POST" });
      await fetchCircle();
      renderCircleList();
      renderWorkspace();
      playChime();
      showToast("Contact recorded! Timer refreshed to today.", `<i class="ri-check-line"></i>`);
    } catch (err) {
      console.error(err);
      showToast("Could not record contact", `<i class="ri-alert-line"></i>`);
    }
  };

  window.handleNotifReview = function(notifId, personId) {
    window.handleMarkNotifRead(notifId);
    window.selectPerson(personId);
    closeNotifDrawer();
  };

  window.handleMarkNotifRead = async function(notifId) {
    try {
      await fetch(`/api/notifications/${notifId}/read`, { method: "POST" });
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  window.handleDismissNotif = async function(notifId) {
    try {
      await fetch(`/api/notifications/${notifId}`, { method: "DELETE" });
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  // Dedicated test alert for a specific loved one
  window.handleTriggerPersonAlert = async function(personId) {
    const person = circleData.find(p => p.id === personId) || circleData[0];
    if (!person) return;
    const initials = person.name.split(' ').map(n => n[0]).join('').slice(0, 2);
    const topFact = person.facts && person.facts[0] ? person.facts[0].content : 'A gentle connection today could mean everything.';
    
    // 1. Play ambient audio chime
    playChime();

    // 2. Show in-page sliding notification card
    showInPageNotification(
      `${person.name} \u00b7 ${person.is_overdue ? 'Overdue ' + person.days_overdue + 'd' : 'Proactive Care Check-in'}`,
      topFact.slice(0, 130),
      person.avatar_color,
      initials,
      person.id
    );

    // 3. Trigger OS desktop web push
    dispatchDesktopNotification(
      `RealCare: ${person.name}`,
      `${person.name} (${person.relationship}) &mdash; ${topFact.slice(0, 100)}`,
      person.id
    );

    // 4. Dispatch backend test notification
    try {
      await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `RealCare: ${person.name}`,
          message: `${person.name} (${person.relationship}) &mdash; ${topFact.slice(0, 110)}`,
          urgency: person.is_overdue ? "high" : "medium",
          channel: "Web Push & SMS Gateway",
          person_id: person.id,
          person_name: person.name
        })
      });
      await fetchNotifications();
    } catch (e) {
      console.error(e);
    }

    showToast(`Live alert dispatched for ${person.name}!`, `<i class="ri-notification-3-line"></i>`);
  };

  async function handleMarkAllNotificationsRead() {
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
      fetchNotifications();
      showToast("All notifications marked read", `<i class="ri-check-line"></i>`);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleTriggerTestAlert() {
    const overdue = circleData.filter(p => p.is_overdue);
    const target = overdue[0] || circleData[0];
    if (target) {
      const initials = target.name.split(' ').map(n => n[0]).join('').slice(0, 2);
      const topFact = target.facts && target.facts[0] ? target.facts[0].content : 'Has not been contacted recently \u2014 a warm message would mean the world.';
      showInPageNotification(
        `${target.name} \u00b7 ${target.is_overdue ? 'Overdue ' + target.days_overdue + 'd' : 'Due soon'}`,
        topFact.slice(0, 120),
        target.avatar_color,
        initials,
        target.id
      );
    }
    showToast("Dispatching live care alert demo...", `<i class="ri-broadcast-line"></i>`);
    try {
      await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: target ? `RealCare: ${target.name} Overdue` : "RealCare Alert",
          message: target ? `${target.name} is overdue by ${target.days_overdue || '?'} days.` : "A loved one needs your attention.",
          urgency: "high",
          channel: "Web Push & SMS Gateway",
          person_id: target ? target.id : "eleanor-vance",
          person_name: target ? target.name : "Eleanor Vance"
        })
      });
      playChime();
      if (target) {
        dispatchDesktopNotification(
          "RealCare Care Alert",
          `${target.name} is overdue by ${target.days_overdue || '?'} days. Open RealCare to review.`,
          target.id
        );
      }
      await fetchNotifications();
      showToast("Live alert dispatched \u2014 check the popup & notification bell!", `<i class="ri-notification-3-line"></i>`);
    } catch (err) {
      console.error(err);
      showToast("Test alert dispatch failed", `<i class="ri-alert-line"></i>`);
    }
  }

  async function handleGlobalScan() {
    const scanIcon = btnGlobalScan.querySelector('i');
    if (scanIcon) scanIcon.classList.add('icon-spin');
    btnGlobalScan.disabled = true;
    agentStatusText.textContent = "Scanning...";
    showToast("Strands Agent is scanning your care circle...", `<i class="ri-radar-line"></i>`);
    try {
      const res = await fetch("/api/agent/scan");
      const scan = await res.json();
      await Promise.all([fetchCircle(), fetchNotifications()]);
      renderCircleList();
      renderWorkspace();
      playChime();

      const overdue = circleData.filter(p => p.is_overdue);
      if (overdue.length > 0) {
        const target = overdue[0];
        const initials = target.name.split(' ').map(n => n[0]).join('').slice(0, 2);
        const topFact = target.facts && target.facts[0] ? target.facts[0].content : 'Has not been contacted recently \u2014 a warm message would mean the world.';
        showInPageNotification(
          `${target.name} \u00b7 Overdue ${target.days_overdue}d`,
          topFact.slice(0, 120),
          target.avatar_color,
          initials,
          target.id
        );
        dispatchDesktopNotification(
          "RealCare: Scan Complete",
          `${overdue.length} loved one(s) are overdue. ${target.name} hasn't been contacted in ${target.days_overdue} days.`
        );
      }

      showToast(`Scan complete: ${scan.overdue_count || overdue.length} overdue.`, `<i class="ri-check-line"></i>`);
    } catch (err) {
      console.error(err);
      showToast("Agent scan error \u2014 is the backend running?", `<i class="ri-alert-line"></i>`);
    } finally {
      if (scanIcon) scanIcon.classList.remove('icon-spin');
      btnGlobalScan.disabled = false;
      agentStatusText.textContent = "Ready";
    }
  }

  async function handleResetData() {
    if (!confirm("Reset circle, drafts, notifications, and family records back to initial seed data?")) return;
    try {
      await fetch("/api/circle/reset", { method: "POST" });
      await loadInitialData();
      playChime();
      showToast("Reset demo data to initial seed state!", `<i class="ri-refresh-line"></i>`);
    } catch (err) {
      console.error(err);
      showToast("Reset failed", `<i class="ri-alert-line"></i>`);
    }
  }

  async function handleAddPersonSubmit(e) {
    e.preventDefault();
    const payload = {
      name: document.getElementById("personName").value,
      relationship: document.getElementById("personRelationship").value,
      checkin_frequency_days: parseInt(document.getElementById("personFrequency").value),
      preferred_channel: document.getElementById("personChannel").value,
      last_contact_date: document.getElementById("personLastContact").value,
      notes: document.getElementById("personNotes").value,
      initial_fact: document.getElementById("personFact").value
    };

    try {
      const res = await fetch("/api/circle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const saved = await res.json();
      modalAddPerson.classList.remove("open");
      formAddPerson.reset();
      await fetchCircle();
      activePersonId = saved.id;
      renderCircleList();
      renderWorkspace();
      playChime();
      showToast(`Added ${saved.name} to your circle!`, `<i class="ri-user-heart-line"></i>`);
    } catch (err) {
      console.error(err);
      showToast("Failed to add person", `<i class="ri-alert-line"></i>`);
    }
  }

  async function handleAddFactSubmit(e) {
    e.preventDefault();
    const personId = document.getElementById("addFactPersonId").value;
    const payload = {
      category: document.getElementById("factCategory").value,
      content: document.getElementById("factContent").value
    };

    try {
      const res = await fetch(`/api/circle/${personId}/facts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      modalAddFact.classList.remove("open");
      formAddFact.reset();
      await fetchCircle();
      renderWorkspace();
      playChime();
      showToast("Memory anchor saved!", `<i class="ri-mind-map"></i>`);
    } catch (err) {
      console.error(err);
      showToast("Failed to add anchor", `<i class="ri-alert-line"></i>`);
    }
  }

  async function handleLogFamilySubmit(e) {
    e.preventDefault();
    const payload = {
      member_name: document.getElementById("famMemberName").value,
      relationship: "Family Member",
      last_contact_date: new Date().toISOString().split("T")[0],
      contact_type: document.getElementById("famContactType").value,
      summary_note: document.getElementById("famSummary").value
    };

    try {
      await fetch("/api/family-view/eleanor-vance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      modalLogFamily.classList.remove("open");
      formLogFamily.reset();
      await Promise.all([fetchFamilyView(), fetchNotifications()]);
      renderWorkspace();
      playChime();
      showToast("Logged family check-in! Thank you.", `<i class="ri-heart-line"></i>`);
    } catch (err) {
      console.error(err);
      showToast("Failed to log check-in", `<i class="ri-alert-line"></i>`);
    }
  }

  function showToast(msg, iconHtml = `<i class="ri-sparkling-2-line"></i>`) {
    const toast = document.getElementById("appToast");
    const toastMessage = document.getElementById("toastMessage");
    const toastIcon = document.getElementById("toastIcon");

    if (!toast || !toastMessage || !toastIcon) return;

    toastMessage.textContent = msg;
    if (typeof iconHtml === 'string' && iconHtml.startsWith('<')) {
      toastIcon.innerHTML = iconHtml;
    } else {
      toastIcon.textContent = iconHtml || '✨';
    }
    toast.classList.add("show");

    setTimeout(() => {
      toast.classList.remove("show");
    }, 3600);
  }

  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function escapeAttr(text) {
    if (!text) return "";
    return text.replace(/'/g, "\\'").replace(/"/g, "&quot;");
  }

  // === In-Page Notification Popup ===
  function showInPageNotification(title, message, avatarColor, avatarInitial, personId) {
    const popup     = document.getElementById('notifPopup');
    const popupTitle= document.getElementById('popupTitle');
    const popupMsg  = document.getElementById('popupMsg');
    const popupAvatar = document.getElementById('popupAvatar');
    const popupBar  = document.getElementById('popupBar');
    const btnReview = document.getElementById('btnPopupReview');
    const btnClose  = document.getElementById('btnClosePopup');
    const btnDismiss= document.getElementById('btnPopupDismiss');

    if (!popup) return;

    if (popupTitle) popupTitle.textContent  = title;
    if (popupMsg) popupMsg.textContent    = message;
    if (popupAvatar) {
      popupAvatar.textContent = avatarInitial || '?';
      popupAvatar.style.background = avatarColor || 'var(--emerald-dim)';
    }

    // Re-trigger bar countdown animation
    if (popupBar) {
      popupBar.style.animation = 'none';
      void popupBar.offsetWidth;
      popupBar.style.animation = '';
    }

    if (personId && btnReview) {
      btnReview.onclick = () => { window.selectPerson(personId); dismiss(); };
    }

    popup.classList.add('show');
    playChime();

    const tid = setTimeout(dismiss, 7200);
    function dismiss() {
      clearTimeout(tid);
      popup.classList.remove('show');
    }
    if (btnClose) btnClose.onclick   = dismiss;
    if (btnDismiss) btnDismiss.onclick = dismiss;
  }

  // Start RealCare
  loadInitialData();
});
