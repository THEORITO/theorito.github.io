const serverAddress = "cairo-seal.tun.ply.gg:13065";
const statusEndpoint = `https://api.mcsrvstat.us/3/${encodeURIComponent(serverAddress)}`;
const statusDot = document.querySelector("#status-dot");
const statusText = document.querySelector("#server-status");
const statusDetail = document.querySelector("#status-detail");
const playersCount = document.querySelector("#players-count");
const playersDetail = document.querySelector("#players-detail");
const refreshButton = document.querySelector("#refresh-status");
const copyButton = document.querySelector("#copy-address");
const copyLabel = document.querySelector("#copy-label");
const copyFeedback = document.querySelector("#copy-feedback");

function showUnavailable(message) {
  statusDot.className = "status-dot is-unavailable";
  statusText.textContent = "Statut indisponible";
  statusDetail.textContent = message;
  playersCount.innerHTML = "— <span>/ —</span>";
  playersDetail.textContent = "Données indisponibles";
}

async function updateStatus() {
  refreshButton.disabled = true;
  statusDot.className = "status-dot is-loading";
  statusText.textContent = "Vérification…";
  statusDetail.textContent = "Connexion au service de statut";
  playersDetail.textContent = "Données en cours de chargement";

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(statusEndpoint, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error("Le service de statut ne répond pas.");
    const data = await response.json();

    if (data.online === true) {
      statusDot.className = "status-dot is-online";
      statusText.textContent = "En ligne";
      statusDetail.textContent = "Le serveur accepte les connexions.";
      const online = Number.isFinite(data.players?.online) ? data.players.online : null;
      const maximum = Number.isFinite(data.players?.max) ? data.players.max : null;
      playersCount.innerHTML = online === null
        ? "— <span>/ —</span>"
        : `${online} <span>/ ${maximum === null ? "—" : maximum}</span>`;
      playersDetail.textContent = online === null ? "Nombre de joueurs indisponible" : "Joueurs en ligne";
    } else if (data.online === false) {
      statusDot.className = "status-dot is-offline";
      statusText.textContent = "Hors ligne";
      statusDetail.textContent = "Le serveur ne répond pas actuellement.";
      playersCount.innerHTML = "0 <span>/ —</span>";
      playersDetail.textContent = "Aucun joueur connecté";
    } else {
      showUnavailable("Réponse inattendue du service de statut.");
    }
  } catch {
    showUnavailable("Vérifie ta connexion ou réessaie dans un instant.");
  } finally {
    window.clearTimeout(timeout);
    refreshButton.disabled = false;
  }
}

async function copyAddress() {
  try {
    await navigator.clipboard.writeText(serverAddress);
  } catch {
    const temporaryInput = document.createElement("textarea");
    temporaryInput.value = serverAddress;
    temporaryInput.setAttribute("readonly", "");
    temporaryInput.style.position = "fixed";
    temporaryInput.style.opacity = "0";
    document.body.append(temporaryInput);
    temporaryInput.select();
    const copied = document.execCommand("copy");
    temporaryInput.remove();
    if (!copied) {
      copyFeedback.textContent = `Copie impossible. Adresse : ${serverAddress}`;
      return;
    }
  }

  copyLabel.textContent = "Copiée";
  copyFeedback.textContent = "Adresse copiée dans le presse-papiers.";
  window.setTimeout(() => {
    copyLabel.textContent = "Copier";
    copyFeedback.textContent = "Minecraft Java Edition · colle l’adresse dans Multijoueur.";
  }, 2200);
}

refreshButton.addEventListener("click", updateStatus);
copyButton.addEventListener("click", copyAddress);
updateStatus();
window.setInterval(updateStatus, 60000);