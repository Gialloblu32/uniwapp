const cruiseCodeText = document.getElementById("cruiseCodeText");
const guestExcursionsList = document.getElementById("guestExcursionsList");

function buildExcursionLine(excursion) {
  const day = excursion.day_number ? `Day ${excursion.day_number}` : "Day ?";
  const port = excursion.port || "Unknown port";
  const name = excursion.excursion_name || "Unknown excursion";
  return `${day} · ${port} · ${name}`;
}

function renderGuestExcursions(rooms) {
  if (!Array.isArray(rooms) || rooms.length === 0) {
    guestExcursionsList.innerHTML = `<div class="empty-state">No guest excursions have been submitted yet.</div>`;
    return;
  }

  guestExcursionsList.innerHTML = rooms
    .map((room) => {
      const guestsHtml = room.guests
        .map((guest) => {
          const summaryLines = guest.excursions.length
            ? guest.excursions.map(buildExcursionLine).join("<br>")
            : "No excursions";

          return `
            <div class="guest-item" data-room="${room.room_number}">
              <button type="button" class="guest-select">
                <span class="guest-name">${guest.guest_name || "Guest"}</span>
              </button>
              <div class="excursions-summary" style="display: none;">
                ${summaryLines}
              </div>
            </div>
          `;
        })
        .join("");

      return `
        <section class="card my-tours-day-card reception-totals-day-card guest-excursions-card">
          <div class="day-group-header reception-totals-day-header">
            <h2>Room ${room.room_number}</h2>
          </div>
          <div class="guests-list">
            ${guestsHtml}
          </div>
        </section>
      `;
    })
    .join("");

  document.querySelectorAll(".guest-select").forEach((button) => {
    button.addEventListener("click", function () {
      const item = this.closest(".guest-item");
      const summary = item.querySelector(".excursions-summary");
      const expanded = summary.style.display !== "none";

      document.querySelectorAll(".guest-item.expanded").forEach((expandedItem) => {
        if (expandedItem !== item) {
          expandedItem.classList.remove("expanded");
          expandedItem.querySelector(".excursions-summary").style.display = "none";
        }
      });

      summary.style.display = expanded ? "none" : "block";
      item.classList.toggle("expanded", !expanded);
    });
  });
}

async function loadGuestExcursions() {
  guestExcursionsList.innerHTML = `<div class="empty-state">Loading guest excursions...</div>`;

  try {
    const response = await fetch("/api/reception/excursions-by-guest");
    const data = await response.json();

    if (!response.ok) {
      guestExcursionsList.innerHTML = `<div class="empty-state">${data.error || "Could not load guest excursions."}</div>`;
      return;
    }

    if (data.cruise_code && cruiseCodeText) {
      cruiseCodeText.textContent = `Cruise ${data.cruise_code}`;
    }

    renderGuestExcursions(data.rooms || []);
  } catch (error) {
    guestExcursionsList.innerHTML = `<div class="empty-state">Could not load guest excursions. Please refresh and try again.</div>`;
  }
}

loadGuestExcursions();
