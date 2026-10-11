const apiBase = String(window.ORITO_API_BASE || "").replace(/\/+$/, "");
const accessDot = document.querySelector("#access-dot");
const accessTitle = document.querySelector("#access-title");
const accessMessage = document.querySelector("#access-message");
const refreshButton = document.querySelector("#refresh-admin");
const actionButtons = [...document.querySelectorAll(".action-buttons button")];
const actionResult = document.querySelector("#action-result");
const logs = document.querySelector("#server-logs");
let authorized = false;

function setActionsEnabled(enabled) {
  actionButtons.forEach((button) => { button.disabled = !enabled; });
  refreshButton.disabled = !enabled;
}

function showUnavailable(message, title = "API privée inaccessible") {
  authorized = false;
  setActionsEnabled(false);
  accessDot.className = "status-dot is-unavailable";
  accessTitle.textContent = title;
  accessMessage.textContent = message;
  document.querySelector("#host-status").textContent = "Indisponible";
  document.querySelector("#minecraft-status").textContent = "Indisponible";
  document.querySelector("#admin-players").innerHTML = "— <span>/ —</span>";
  document.querySelector("#admin-players-detail").textContent = "Données indisponibles";
}

async function requestApi(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      signal: controller.signal,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...options.headers }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.message || `Erreur API (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return body;
  } finally {
    window.clearTimeout(timeout);
  }
}

function renderStatus(data) {
  document.querySelector("#host-status").textContent = data.host?.reachable ? "Accessible" : "Injoignable";
  document.querySelector("#host-detail").textContent = data.host?.reachable
    ? "API Ubuntu joignable sur le réseau privé."
    : "La machine ou son API ne répond pas.";
  document.querySelector("#minecraft-status").textContent = data.minecraft?.active ? "En ligne" : "Arrêté";
  document.querySelector("#minecraft-detail").textContent = data.minecraft?.active
    ? "Service minecraft.service actif."
    : "La machine Ubuntu peut rester allumée.";
  const online = Number.isFinite(data.players?.online) ? data.players.online : null;
  const maximum = Number.isFinite(data.players?.max) ? data.players.max : null;
  document.querySelector("#admin-players").innerHTML = online === null
    ? "— <span>/ —</span>"
    : `${online} <span>/ ${maximum === null ? "—" : maximum}</span>`;
  document.querySelector("#admin-players-detail").textContent = online === null
    ? "Nombre de joueurs indisponible"
    : "Joueurs connectés";
}

async function refreshAdmin() {
  if (!apiBase) {
    showUnavailable("Aucune commande ne sera envoyée. Connecte-toi au réseau privé une fois l’API installée.", "API privée non configurée");
    return;
  }

  refreshButton.disabled = true;
  accessTitle.textContent = "Vérification de l’accès…";
  accessMessage.textContent = "Le backend vérifie l’identité et les droits de cette session.";
  try {
    const session = await requestApi("/api/v1/admin/session");
    if (session.authenticated !== true || session.authorized !== true) {
      showUnavailable("Cette identité n’est pas autorisée à administrer le serveur.", "Accès refusé");
      return;
    }

    authorized = true;
    accessDot.className = "status-dot is-online";
    accessTitle.textContent = "Session administrateur autorisée";
    accessMessage.textContent = "Les requêtes sont protégées par le backend privé.";
    setActionsEnabled(true);
    const [status, logData] = await Promise.all([
      requestApi("/api/v1/admin/status"),
      requestApi("/api/v1/admin/logs?lines=80")
    ]);
    renderStatus(status);
    logs.textContent = Array.isArray(logData.lines) ? logData.lines.join("\n") : "Aucun log disponible.";
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      showUnavailable("Cette identité n’est pas autorisée à administrer le serveur.", "Accès refusé");
    } else {
      showUnavailable("API inaccessible. Vérifie la connexion Tailscale et l’état de la machine Ubuntu.");
    }
  } finally {
    refreshButton.disabled = !authorized;
  }
}

async function performAction(action) {
  if (!authorized) return;
  const labels = { start: "démarrer", stop: "arrêter proprement", restart: "redémarrer" };
  if (!window.confirm(`Confirmer : ${labels[action]} Minecraft ?`)) return;

  setActionsEnabled(false);
  actionResult.textContent = `Demande pour ${labels[action]} en cours…`;
  try {
    const result = await requestApi("/api/v1/admin/actions", {
      method: "POST",
      body: JSON.stringify({ action })
    });
    actionResult.textContent = result.message || `Action « ${labels[action]} » acceptée.`;
    await refreshAdmin();
  } catch (error) {
    actionResult.textContent = error.message || "L’action a échoué. Réessaie ou consulte les logs.";
    setActionsEnabled(authorized);
  }
}

document.querySelector("#start-server").addEventListener("click", () => performAction("start"));
document.querySelector("#stop-server").addEventListener("click", () => performAction("stop"));
document.querySelector("#restart-server").addEventListener("click", () => performAction("restart"));
refreshButton.addEventListener("click", refreshAdmin);
refreshAdmin();