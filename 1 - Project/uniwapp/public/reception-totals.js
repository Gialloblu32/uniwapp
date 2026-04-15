const cruiseCodeText = document.getElementById("cruiseCodeText");
const totalRoomsElement = document.getElementById("totalRooms");
const submittedRoomsElement = document.getElementById("submittedRooms");
const pendingRoomsElement = document.getElementById("pendingRooms");
const excursionTotalsList = document.getElementById("excursionTotalsList");

function goBackToReception() {
  window.location.href = "reception.html";
}

function formatPrice(value) {
  const cleaned = String(value || "").trim();
  const numericPrice = Number(cleaned);

  if (!cleaned || Number.isNaN(numericPrice) || numericPrice <= 0) {
    return "";
  }

  return `${numericPrice}\u00A0€`;
}

function formatExcursionLabel(item) {
  const section = String(item.section || "").trim().toLowerCase();
  const excursionName = item.excursion_name || "—";
  const priceText = formatPrice(item.price);

  let prefixHtml = "";

  if (section === "masterpiece") {
    prefixHtml = `<strong class="excursion-prefix">MC</strong>: `;
  } else if (section === "onboard" || section === "special-dinner") {
    prefixHtml = `<strong class="excursion-prefix">ONBOARD</strong>: `;
  }

  const priceHtml = priceText
    ? ` <strong class="excursion-price">${priceText}</strong>`
    : "";

  return `${prefixHtml}<span class="excursion-label-text">${excursionName}</span>${priceHtml}`;
}

function renderSummary(summary) {
  totalRoomsElement.textContent = String(summary?.total_rooms || 0);
  submittedRoomsElement.textContent = String(summary?.submitted_rooms || 0);
  pendingRoomsElement.textContent = String(summary?.pending_rooms || 0);
}

function groupTotalsByDayAndPort(totals) {
  const groups = [];
  let currentGroup = null;

  totals.forEach((item) => {
    const dayNumber = String(item.day_number || "—").trim();
    const port = String(item.port || "—").trim();
    const groupKey = `${dayNumber}__${port.toLowerCase()}`;

    if (!currentGroup || currentGroup.key !== groupKey) {
      currentGroup = {
        key: groupKey,
        day_number: dayNumber,
        port: port,
        items: []
      };
      groups.push(currentGroup);
    }

    currentGroup.items.push(item);
  });

  return groups;
}

function renderTotalsList(totals) {
  if (!Array.isArray(totals) || totals.length === 0) {
    excursionTotalsList.innerHTML = `<div class="empty-state">No excursion totals are available yet for this cruise.</div>`;
    return;
  }

  const groupedTotals = groupTotalsByDayAndPort(totals);

  excursionTotalsList.innerHTML = groupedTotals
    .map((group) => {
      const rowsHtml = group.items
        .map((item) => {
          return `
            <tr>
              <td class="totals-excursion-cell">${formatExcursionLabel(item)}</td>
              <td class="totals-count-cell">${item.total_selected || 0}</td>
            </tr>
          `;
        })
        .join("");

      return `
        <section class="card my-tours-day-card reception-totals-day-card">
          <div class="day-group-header reception-totals-day-header">
            <span class="day-label">Day ${group.day_number}</span>
            <h2>${group.port}</h2>
          </div>

          <div class="table-wrap">
            <table class="excursions-table reception-totals-table">
              <thead>
                <tr>
                  <th>Excursion</th>
                  <th>Total Selected</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </section>
      `;
    })
    .join("");
}

async function loadExcursionTotals() {
  excursionTotalsList.innerHTML = `<div class="empty-state">Loading excursion totals...</div>`;

  try {
    const response = await fetch("/api/reception/excursion-totals");
    const data = await response.json();

    if (!response.ok) {
      excursionTotalsList.innerHTML = `<div class="empty-state">${data.error || "Could not load excursion totals."}</div>`;
      return;
    }

    cruiseCodeText.textContent = data.cruise_code ? `Cruise ${data.cruise_code}` : "";
    renderSummary(data.summary || {});
    renderTotalsList(data.totals || []);
  } catch (error) {
    excursionTotalsList.innerHTML = `<div class="empty-state">Could not load excursion totals.</div>`;
  }
}

loadExcursionTotals();