const roomHeaderText = document.getElementById("roomHeaderText");
const roomTitle = document.getElementById("roomTitle");
const roomSubtitle = document.getElementById("roomSubtitle");
const roomInfo = document.getElementById("roomInfo");
const roomSelections = document.getElementById("roomSelections");

function goBackToReception() {
  window.location.href = "reception.html";
}

function getBookingIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("booking_id") || "";
}

function formatSubmittedAt(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function getFieldValue(item, possibleKeys) {
  for (const key of possibleKeys) {
    if (
      item[key] !== undefined &&
      item[key] !== null &&
      String(item[key]).trim() !== ""
    ) {
      return String(item[key]).trim();
    }
  }

  return "";
}

function getDayNumber(item) {
  const rawDay = getFieldValue(item, ["day", "day_number", "Day", "dayNumber"]);
  const match = rawDay.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function getCity(item) {
  return getFieldValue(item, [
    "city",
    "City",
    "port",
    "Port",
    "destination",
    "Destination",
    "location",
    "Location"
  ]);
}

function getSection(item) {
  return getFieldValue(item, ["section", "Section"]).toLowerCase();
}

function getName(item) {
  return getFieldValue(item, [
    "name",
    "Name",
    "excursion_name",
    "Excursion Name",
    "activity_name",
    "Activity Name",
    "title",
    "Title"
  ]);
}

function getPrice(item) {
  return getFieldValue(item, ["price", "Price"]);
}

function isItemActive(item) {
  const status = getFieldValue(item, ["status", "Status"]).toLowerCase();
  const active = getFieldValue(item, ["active", "Active"]).toLowerCase();

  if (status) {
    return status === "active";
  }

  if (active) {
    return active === "yes" || active === "true" || active === "active";
  }

  return true;
}

function normalizeExcursion(item) {
  return {
    day_number: getDayNumber(item),
    port: getCity(item),
    section: getSection(item),
    excursion_name: getName(item),
    price: getPrice(item)
  };
}

function sortExcursions(excursions) {
  return [...excursions].sort((a, b) => {
    const dayA = Number(a.day_number || 0);
    const dayB = Number(b.day_number || 0);

    if (dayA !== dayB) {
      return dayA - dayB;
    }

    return String(a.excursion_name || "").localeCompare(String(b.excursion_name || ""));
  });
}

function groupExcursionsByDay(excursions) {
  const grouped = {};

  sortExcursions(excursions).forEach((excursion) => {
    const key = `${excursion.day_number}__${excursion.port}`;

    if (!grouped[key]) {
      grouped[key] = {
        day_number: excursion.day_number,
        port: excursion.port,
        items: []
      };
    }

    grouped[key].items.push(excursion);
  });

  return Object.values(grouped).sort(
    (a, b) => Number(a.day_number) - Number(b.day_number)
  );
}

function getGuestLabel(fullName, fallbackNumber) {
  const cleaned = String(fullName || "").trim();

  if (!cleaned) {
    return `Guest ${fallbackNumber}`;
  }

  return cleaned;
}

function isExcursionSelectedByGuest(selections, excursion, guestName) {
  return selections.some((selection) => {
    return (
      String(selection.guest_name || "").trim() === String(guestName || "").trim() &&
      String(selection.excursion_name || "").trim() === String(excursion.excursion_name || "").trim() &&
      String(selection.port || "").trim() === String(excursion.port || "").trim() &&
      String(selection.day_number || "").trim() === String(excursion.day_number || "").trim()
    );
  });
}

function renderRoomInfo(data) {
  const guestList = Array.isArray(data.guests) && data.guests.length
    ? data.guests.join(", ")
    : "—";

  roomInfo.innerHTML = `
    <div class="room-info-grid">
      <div><strong>Room:</strong> ${data.room_number || "—"}</div>
      <div><strong>Booking ID:</strong> ${data.booking_id || "—"}</div>
      <div><strong>Status:</strong> ${data.submitted ? "Submitted" : "Pending"}</div>
      <div><strong>Submitted At:</strong> ${formatSubmittedAt(data.submitted_at)}</div>
      <div class="room-info-full"><strong>Guests:</strong> ${guestList}</div>
    </div>
  `;
}

async function loadAllExcursions() {
  const response = await fetch("/api/excursions");
  const rawItems = await response.json();

  if (!response.ok || !Array.isArray(rawItems)) {
    throw new Error("Could not load excursions");
  }

  return rawItems
    .filter((item) => isItemActive(item))
    .map((item) => normalizeExcursion(item))
    .filter((item) => item.day_number !== null)
    .filter((item) => {
      const section = item.section;
      const rawPrice = String(item.price || "").trim();
      const numericPrice = Number(rawPrice);
      const hasPaidPrice = rawPrice !== "" && !Number.isNaN(numericPrice) && numericPrice > 0;

      if (section === "included" || section === "masterpiece") {
        return true;
      }

      if ((section === "special-dinner" || section === "onboard") && hasPaidPrice) {
        return true;
      }

      return false;
    })
    .filter((item) => item.excursion_name);
}

function formatExcursionLabel(excursion) {
  const name = String(excursion.excursion_name || "").trim();
  const section = String(excursion.section || "").trim().toLowerCase();
  const rawPrice = String(excursion.price || "").trim();
  const numericPrice = Number(rawPrice);
  const hasPaidPrice = rawPrice !== "" && !Number.isNaN(numericPrice) && numericPrice > 0;

  let prefixHtml = "";
  let priceHtml = "";

  if (section === "masterpiece") {
    prefixHtml = `<strong class="excursion-prefix">MC</strong>: `;
  } else if (section === "onboard" || section === "special-dinner") {
    prefixHtml = `<strong class="excursion-prefix">ONBOARD</strong>: `;
  }

  if (hasPaidPrice) {
    priceHtml = ` <strong class="excursion-price">${numericPrice}&nbsp;€</strong>`;
  }

  return `${prefixHtml}<span class="excursion-label-text">${name}</span>${priceHtml}`;
}

function getNumericPrice(value) {
  const cleaned = String(value || "").trim();

  if (!cleaned) {
    return 0;
  }

  const numericPrice = Number(cleaned);
  return Number.isNaN(numericPrice) ? 0 : numericPrice;
}

function findMatchingExcursion(selection, allExcursions) {
  return allExcursions.find((excursion) => {
    return (
      String(excursion.excursion_name || "").trim() === String(selection.excursion_name || "").trim() &&
      String(excursion.port || "").trim() === String(selection.port || "").trim() &&
      String(excursion.day_number || "").trim() === String(selection.day_number || "").trim()
    );
  });
}

function getSelectionPrice(selection, allExcursions) {
  const directPrice = getNumericPrice(selection.price);

  if (directPrice > 0) {
    return directPrice;
  }

  const matchingExcursion = findMatchingExcursion(selection, allExcursions);
  return matchingExcursion ? getNumericPrice(matchingExcursion.price) : 0;
}

function formatEuroAmount(value) {
  return `${value}\u00A0€`;
}

/* ✅ FIXED TOTALS (aligned with columns) */
function renderGuestTotals(data, allExcursions) {
  const guestTotals = (Array.isArray(data.guests) ? data.guests : []).map((guestName, index) => {
    const total = (Array.isArray(data.selections) ? data.selections : []).reduce((sum, selection) => {
      const matchesGuest =
        String(selection.guest_name || "").trim() === String(guestName || "").trim();

      if (!matchesGuest) return sum;

      return sum + getSelectionPrice(selection, allExcursions);
    }, 0);

    return {
      guest_name: getGuestLabel(guestName, index + 1),
      total
    };
  });

  if (!guestTotals.length) return "";

  return `
    <section class="card">
      <div class="table-wrap">
        <table class="excursions-table room-check-table">
          <colgroup>
            <col class="col-excursion">
            ${guestTotals.map(() => '<col class="col-guest">').join("")}
          </colgroup>
          <tbody>
            <tr>
              <td class="excursion-name-cell"><strong>Total</strong></td>
              ${guestTotals.map(g => `
                <td class="selection-mark-cell">
                  <strong>${formatEuroAmount(g.total)}</strong>
                </td>
              `).join("")}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderSelections(data, allExcursions) {
  const guest1 = getGuestLabel(data.guests?.[0], 1);
  const guest2Exists = !!data.guests?.[1];
  const guest2 = getGuestLabel(data.guests?.[1], 2);

  const groupedDays = groupExcursionsByDay(allExcursions);

  const daySectionsHtml = groupedDays.map((dayGroup, index) => {
    const rowsHtml = dayGroup.items.map((excursion) => {
      const guest1Selected = data.submitted
        ? isExcursionSelectedByGuest(data.selections || [], excursion, data.guests?.[0] || "")
        : false;

      const guest2Selected = guest2Exists && data.submitted
        ? isExcursionSelectedByGuest(data.selections || [], excursion, data.guests?.[1] || "")
        : false;

      return `
        <tr>
          <td class="excursion-name-cell">${formatExcursionLabel(excursion)}</td>
          <td class="selection-mark-cell">${guest1Selected ? '<span class="selection-mark">X</span>' : ""}</td>
          ${guest2Exists ? `<td class="selection-mark-cell">${guest2Selected ? '<span class="selection-mark">X</span>' : ""}</td>` : ""}
        </tr>
      `;
    }).join("");

    return `
      <section class="card my-tours-day-card ${index % 2 === 0 ? "day-theme-light" : "day-theme-soft"}">
        <div class="day-group-header">
          <div class="day-label">Day ${dayGroup.day_number}</div>
          <h2>${dayGroup.port || ""}</h2>
        </div>

        <div class="table-wrap">
          <table class="excursions-table room-check-table">
            <colgroup>
              <col class="col-excursion">
              <col class="col-guest">
              ${guest2Exists ? '<col class="col-guest">' : ""}
            </colgroup>
            <thead>
              <tr>
                <th>Excursion</th>
                <th>${guest1}</th>
                ${guest2Exists ? `<th>${guest2}</th>` : ""}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }).join("");

  const guestTotalsHtml = renderGuestTotals(data, allExcursions);

  roomSelections.innerHTML = `${daySectionsHtml}${guestTotalsHtml}`;

  if (!groupedDays.length) {
    roomSelections.innerHTML = `<div class="empty-state"><p>No excursions found for this cruise.</p></div>`;
  }
}

async function loadRoomDetails() {
  const bookingId = getBookingIdFromUrl();

  if (!bookingId) {
    roomInfo.innerHTML = `<p>Missing booking ID.</p>`;
    roomSelections.innerHTML = "";
    return;
  }

  try {
    const [roomResponse, excursions] = await Promise.all([
      fetch(`/api/reception/room?booking_id=${encodeURIComponent(bookingId)}`),
      loadAllExcursions()
    ]);

    const data = await roomResponse.json();

    if (!roomResponse.ok) {
      roomInfo.innerHTML = `<p>${data.error || "Could not load room details."}</p>`;
      roomSelections.innerHTML = "";
      return;
    }

    if (roomHeaderText) roomHeaderText.textContent = `Room ${data.room_number || ""}`;
    if (roomTitle) roomTitle.textContent = `Room ${data.room_number || ""}`;
    if (roomSubtitle) roomSubtitle.textContent = `Booking ${data.booking_id || ""}`;

    renderRoomInfo(data);
    renderSelections(data, excursions);
  } catch (error) {
    roomInfo.innerHTML = `<p>Could not load room details.</p>`;
    roomSelections.innerHTML = "";
  }
}

loadRoomDetails();