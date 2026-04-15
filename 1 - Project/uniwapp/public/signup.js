const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const loginSection = document.getElementById("loginSection");
const excursionsSection = document.getElementById("excursionsSection");
const daysContainer = document.getElementById("daysContainer");
const bookingText = document.getElementById("bookingText");
const welcomeText = document.getElementById("welcomeText");
const confirmSelectionsBtn = document.getElementById("confirmSelectionsBtn");
const confirmMessage = document.getElementById("confirmMessage");
const totalPriceElement = document.getElementById("totalPrice");
const chargeAgreementCheckbox = document.getElementById("chargeAgreementCheckbox");
const chargeAgreementMessage = document.getElementById("chargeAgreementMessage");

function goToOverview() {
  window.location.href = "index.html";
}

function goToMyTours() {
  window.location.href = "my-tours.html";
}

function getSavedBooking() {
  return JSON.parse(localStorage.getItem("uniwappBooking"));
}

function getSavedSelections() {
  return JSON.parse(localStorage.getItem("uniwappSelections")) || [];
}

function getConfirmedBookings() {
  return JSON.parse(localStorage.getItem("uniwappConfirmedBookings")) || [];
}

function isBookingConfirmed(bookingId) {
  const confirmedBookings = getConfirmedBookings();
  return confirmedBookings.includes(String(bookingId));
}

function markBookingConfirmed(bookingId) {
  const confirmedBookings = getConfirmedBookings();
  const bookingIdString = String(bookingId);

  if (!confirmedBookings.includes(bookingIdString)) {
    confirmedBookings.push(bookingIdString);
    localStorage.setItem("uniwappConfirmedBookings", JSON.stringify(confirmedBookings));
  }
}

function saveSelectionsToLocal(bookingId, newSelections) {
  const allSelections = getSavedSelections();
  const otherBookingsSelections = allSelections.filter(
    (selection) => String(selection.booking_id) !== String(bookingId)
  );

  const updatedSelections = [...otherBookingsSelections, ...newSelections];
  localStorage.setItem("uniwappSelections", JSON.stringify(updatedSelections));
}

async function getSubmissionFromServer(bookingId) {
  try {
    const response = await fetch("/api/submissions");
    const submissions = await response.json();

    if (!response.ok || !Array.isArray(submissions)) {
      return null;
    }

    const submission = submissions.find(
      (item) => String(item.booking_id) === String(bookingId)
    );

    return submission || null;
  } catch (error) {
    return null;
  }
}

async function syncBookingFromServer(bookingId) {
  const submission = await getSubmissionFromServer(bookingId);

  if (!submission) {
    return false;
  }

  const serverSelections = Array.isArray(submission.selections)
    ? submission.selections
    : [];

  if (serverSelections.length === 0) {
    return false;
  }

  markBookingConfirmed(bookingId);
  saveSelectionsToLocal(bookingId, serverSelections);
  return true;
}

function setElementVisibility(id, shouldShow) {
  const element = document.getElementById(id);

  if (element) {
    element.style.display = shouldShow ? "" : "none";
  }
}

function updateNavigationVisibility() {
  const savedBooking = getSavedBooking();

  if (!savedBooking) {
    setElementVisibility("signupNavItem", true);
    setElementVisibility("signupSeparator", true);
    setElementVisibility("myToursNavItem", false);
    setElementVisibility("myToursSeparator", false);
    return;
  }

  const confirmed = isBookingConfirmed(savedBooking.booking_id);

  setElementVisibility("signupNavItem", !confirmed);
  setElementVisibility("signupSeparator", !confirmed);
  setElementVisibility("myToursNavItem", confirmed);
  setElementVisibility("myToursSeparator", confirmed);
}

function setBookingHeader() {
  const savedBooking = getSavedBooking();

  if (savedBooking) {
    bookingText.textContent = `Booking ${savedBooking.booking_id} • Room ${savedBooking.room_number}`;

    if (isBookingConfirmed(savedBooking.booking_id)) {
      welcomeText.textContent = "Your excursions are confirmed. To make changes, please contact Reception.";
    } else {
      welcomeText.textContent = "Choose excursions by day, then confirm all together.";
    }
  } else {
    bookingText.textContent = "";
    welcomeText.textContent = "Please log in to choose excursions.";
  }

  updateNavigationVisibility();
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

function getStartTime(item) {
  return getFieldValue(item, ["start_time", "Start Time", "start"]);
}

function getEndTime(item) {
  return getFieldValue(item, ["end_time", "End Time", "end"]);
}

function getPrice(item) {
  return getFieldValue(item, ["price", "Price"]);
}

function getMinCapacity(item) {
  return getFieldValue(item, ["capacity_min", "min_capacity", "Min Capacity"]);
}

function getMaxCapacity(item) {
  return getFieldValue(item, ["capacity_max", "max_capacity", "Max Capacity"]);
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
    start_time: getStartTime(item),
    end_time: getEndTime(item),
    price: getPrice(item),
    min_capacity: getMinCapacity(item),
    max_capacity: getMaxCapacity(item)
  };
}

function groupExcursionsByDay(excursions) {
  const grouped = {};

  excursions.forEach((excursion) => {
    const key = `${excursion.day_number}__${excursion.port}`;

    if (!grouped[key]) {
      grouped[key] = {
        day_number: excursion.day_number,
        port: excursion.port,
        included: [],
        masterpiece: [],
        specialDinner: []
      };
    }

    if (excursion.section === "masterpiece") {
      grouped[key].masterpiece.push(excursion);
    } else if (excursion.section === "special-dinner") {
      grouped[key].specialDinner.push(excursion);
    } else {
      grouped[key].included.push(excursion);
    }
  });

  return Object.values(grouped).sort(
    (a, b) => Number(a.day_number) - Number(b.day_number)
  );
}

function isSelectionSaved(savedSelections, bookingId, guestName, excursion) {
  return savedSelections.some((selection) => {
    return (
      String(selection.booking_id) === String(bookingId) &&
      selection.guest_name === guestName &&
      selection.excursion_name === excursion.excursion_name &&
      selection.port === excursion.port &&
      String(selection.day_number) === String(excursion.day_number) &&
      selection.start_time === excursion.start_time &&
      selection.end_time === excursion.end_time
    );
  });
}

function formatPrice(value, section = "") {
  if (section === "included") {
    return "Included";
  }

  const cleaned = String(value || "").trim();
  if (!cleaned) {
    return section === "masterpiece" || section === "special-dinner"
      ? "€0"
      : "Included";
  }

  const number = Number(cleaned);
  return Number.isNaN(number) ? cleaned : `€${number}`;
}

function formatMin(value) {
  const cleaned = String(value || "").trim();
  if (!cleaned) {
    return "—";
  }

  const number = Number(cleaned);
  return Number.isNaN(number) || number <= 0 ? "—" : number;
}

function formatMax(value) {
  const cleaned = String(value || "").trim();
  if (!cleaned) {
    return "—";
  }

  const number = Number(cleaned);
  return Number.isNaN(number) || number <= 0 ? "—" : number;
}

function splitGuestName(fullName, index) {
  const cleaned = String(fullName || "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] || `Guest ${index + 1}`,
    lastName: parts.slice(1).join(" ")
  };
}

function convertTo24Hour(timeStr) {
  if (!timeStr) {
    return null;
  }

  const cleaned = String(timeStr).trim().toUpperCase();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);

  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const modifier = match[3];

  if (modifier === "PM" && hours !== 12) {
    hours += 12;
  }

  if (modifier === "AM" && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
}

function timesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function clearInlineConflictMessages() {
  document.querySelectorAll(".conflict-message").forEach((message) => {
    if (message.id !== "chargeAgreementMessage") {
      message.remove();
    }
  });
}

function appendInlineConflictMessage(checkbox, message) {
  const card = checkbox.closest(".excursion-card-new");

  if (!card) {
    return;
  }

  const existingMessages = Array.from(card.querySelectorAll(".conflict-message"));
  const alreadyExists = existingMessages.some(
    (item) => item.textContent.trim() === message.trim()
  );

  if (alreadyExists) {
    return;
  }

  const warning = document.createElement("div");
  warning.className = "conflict-message";
  warning.textContent = message;
  card.appendChild(warning);
}

function showChargeAgreementMessage(message) {
  if (!chargeAgreementMessage) {
    return;
  }

  chargeAgreementMessage.textContent = message;
  chargeAgreementMessage.classList.remove("hidden");
}

function clearChargeAgreementMessage() {
  if (!chargeAgreementMessage) {
    return;
  }

  chargeAgreementMessage.textContent = "";
  chargeAgreementMessage.classList.add("hidden");
}

function getCheckedExcursionCheckboxes() {
  return Array.from(document.querySelectorAll(".excursion-checkbox:checked"));
}

function serializeExcursionForDataAttr(excursion) {
  return encodeURIComponent(JSON.stringify(excursion));
}

function getCheckboxExcursionData(checkbox) {
  return JSON.parse(decodeURIComponent(checkbox.dataset.excursion));
}

function getConflictBetweenCheckboxes(checkboxA, checkboxB) {
  if (checkboxA === checkboxB) {
    return null;
  }

  if (checkboxA.dataset.guestName !== checkboxB.dataset.guestName) {
    return null;
  }

  const excursionA = getCheckboxExcursionData(checkboxA);
  const excursionB = getCheckboxExcursionData(checkboxB);

  if (String(excursionA.day_number) !== String(excursionB.day_number)) {
    return null;
  }

  const startA = convertTo24Hour(excursionA.start_time);
  const endA = convertTo24Hour(excursionA.end_time);
  const startB = convertTo24Hour(excursionB.start_time);
  const endB = convertTo24Hour(excursionB.end_time);

  if (startA === null || endA === null || startB === null || endB === null) {
    return null;
  }

  if (!timesOverlap(startA, endA, startB, endB)) {
    return null;
  }

  return {
    guestName: checkboxA.dataset.guestName,
    excursionA,
    excursionB
  };
}

function hasExcursionConflict(currentCheckbox) {
  const checkedBoxes = getCheckedExcursionCheckboxes();

  for (const checkbox of checkedBoxes) {
    if (checkbox === currentCheckbox) {
      continue;
    }

    const conflict = getConflictBetweenCheckboxes(currentCheckbox, checkbox);

    if (conflict) {
      return {
        hasConflict: true,
        conflictingExcursion: conflict.excursionB
      };
    }
  }

  return { hasConflict: false };
}

function renderExistingConflictWarnings() {
  clearInlineConflictMessages();

  const checkedBoxes = getCheckedExcursionCheckboxes();
  let hasAnyConflict = false;

  for (let i = 0; i < checkedBoxes.length; i += 1) {
    for (let j = i + 1; j < checkedBoxes.length; j += 1) {
      const checkboxA = checkedBoxes[i];
      const checkboxB = checkedBoxes[j];
      const conflict = getConflictBetweenCheckboxes(checkboxA, checkboxB);

      if (!conflict) {
        continue;
      }

      hasAnyConflict = true;

      appendInlineConflictMessage(
        checkboxA,
        `${conflict.guestName} has a time conflict with "${conflict.excursionB.excursion_name}".`
      );

      appendInlineConflictMessage(
        checkboxB,
        `${conflict.guestName} has a time conflict with "${conflict.excursionA.excursion_name}".`
      );
    }
  }

  if (hasAnyConflict) {
    confirmMessage.textContent = "Please resolve the overlapping excursion selections before submitting.";
  } else if (!isBookingConfirmed(getSavedBooking()?.booking_id)) {
    confirmMessage.textContent = "";
  }

  return hasAnyConflict;
}

function formatEuroAmount(value) {
  return `€${value}`;
}

function ensureGuestTotalsContainer() {
  const confirmCard = document.querySelector(".compact-confirm-card");

  if (!confirmCard) {
    return null;
  }

  let container = document.getElementById("signupGuestTotalsContainer");

  if (!container) {
    container = document.createElement("div");
    container.id = "signupGuestTotalsContainer";
    container.className = "signup-guest-totals-block";

    const totalInner = confirmCard.querySelector(".compact-total-inner");

    if (totalInner && totalInner.nextSibling) {
      confirmCard.insertBefore(container, totalInner.nextSibling);
    } else if (totalInner) {
      confirmCard.appendChild(container);
    } else {
      confirmCard.appendChild(container);
    }
  }

  return container;
}

function renderGuestTotalsSummary() {
  const booking = getSavedBooking();
  const container = ensureGuestTotalsContainer();

  if (!booking || !container || !Array.isArray(booking.guests) || booking.guests.length === 0) {
    if (container) {
      container.innerHTML = "";
    }
    return;
  }

  const guestTotals = booking.guests.map((guest, index) => {
    const guestName = guest.full_name || `Guest ${index + 1}`;
    let total = 0;

    document.querySelectorAll(`.excursion-checkbox:checked[data-guest-name="${guestName}"]`).forEach((checkbox) => {
      total += Number(checkbox.dataset.price || 0);
    });

    return {
      guest_name: guestName,
      total
    };
  });

  container.innerHTML = `
    <div class="table-wrap">
      <table class="excursions-table signup-guest-totals-table room-check-table">
        <colgroup>
          <col class="col-excursion">
          ${guestTotals.map(() => '<col class="col-guest">').join("")}
        </colgroup>
        <thead>
          <tr>
            <th></th>
            ${guestTotals.map((guest) => `<th>${guest.guest_name}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="excursion-name-cell"><strong>Total by Guest</strong></td>
            ${guestTotals
              .map(
                (guest) => `
                  <td
                    class="signup-guest-total-cell"
                    data-guest-name="${guest.guest_name}"
                  >
                    <span class="signup-guest-total-name">${guest.guest_name}</span>
                    <strong>${formatEuroAmount(guest.total)}</strong>
                  </td>
                `
              )
              .join("")}
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function updateTotalPrice() {
  const checkedBoxes = document.querySelectorAll(".excursion-checkbox:checked");
  let total = 0;

  checkedBoxes.forEach((checkbox) => {
    total += Number(checkbox.dataset.price || 0);
  });

  totalPriceElement.textContent = `€${total}`;
  renderGuestTotalsSummary();
}

function applyConfirmedStateUI() {
  const booking = getSavedBooking();

  if (!booking) {
    return;
  }

  const confirmed = isBookingConfirmed(booking.booking_id);
  const checkboxes = document.querySelectorAll(".excursion-checkbox");

  checkboxes.forEach((checkbox) => {
    checkbox.disabled = confirmed;
  });

  if (chargeAgreementCheckbox) {
    chargeAgreementCheckbox.disabled = confirmed;
  }

  if (confirmed) {
    confirmSelectionsBtn.disabled = false;
    confirmSelectionsBtn.textContent = "See My Tour Selection";
    confirmMessage.textContent = "Your excursions are confirmed. To make changes, please contact Reception.";
    welcomeText.textContent = "Your excursions are confirmed. To make changes, please contact Reception.";

    if (chargeAgreementCheckbox) {
      chargeAgreementCheckbox.checked = true;
    }

    clearChargeAgreementMessage();
  } else {
    confirmSelectionsBtn.disabled = false;
    confirmSelectionsBtn.textContent = "Submit My Selections";
  }

  updateNavigationVisibility();
}

function handleExcursionCheckboxChange(event) {
  const checkbox = event.target;

  if (!checkbox.checked) {
    renderExistingConflictWarnings();
    updateTotalPrice();
    return;
  }

  const conflictCheck = hasExcursionConflict(checkbox);

  if (conflictCheck.hasConflict) {
    const currentExcursion = getCheckboxExcursionData(checkbox);
    checkbox.checked = false;

    clearInlineConflictMessages();
    appendInlineConflictMessage(
      checkbox,
      `${checkbox.dataset.guestName} cannot select "${currentExcursion.excursion_name}" because it overlaps with "${conflictCheck.conflictingExcursion.excursion_name}".`
    );

    updateTotalPrice();
    return;
  }

  renderExistingConflictWarnings();
  updateTotalPrice();
}

function renderExcursionCards(excursions, booking, savedSelections, bookingConfirmed) {
  if (!excursions.length) {
    return `<p class="info-text">No excursions listed in this section for this day.</p>`;
  }

  return excursions
    .map((excursion) => {
      const guestCheckboxes = booking.guests
        .map((guest, i) => {
          const checked = isSelectionSaved(
            savedSelections,
            booking.booking_id,
            guest.full_name,
            excursion
          );

          const name = splitGuestName(guest.full_name, i);

          return `
            <div class="guest-checkbox">
              <div class="guest-label">
                ${name.firstName}<br>${name.lastName}
              </div>
              <input
                type="checkbox"
                class="excursion-checkbox"
                data-guest-name="${guest.full_name}"
                data-price="${Number(excursion.price || 0)}"
                data-excursion="${serializeExcursionForDataAttr(excursion)}"
                ${checked ? "checked" : ""}
                ${bookingConfirmed ? "disabled" : ""}
              />
            </div>
          `;
        })
        .join("");

      return `
        <div class="excursion-card-new compact-excursion-card">
          <div class="excursion-main-row">
            <div class="excursion-left">
              <div class="excursion-main-name">${excursion.excursion_name}</div>

              <div class="excursion-details compact-excursion-details">
                <span><strong>Time:</strong> ${excursion.start_time} – ${excursion.end_time}</span>
                <span><strong>Price:</strong> ${formatPrice(excursion.price, excursion.section)}</span>
                <span><strong>Min / Max:</strong> ${formatMin(excursion.min_capacity)} / ${formatMax(excursion.max_capacity)}</span>
              </div>
            </div>

            <div class="excursion-right compact-excursion-right">
              ${guestCheckboxes}
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderDayTables(excursions, booking) {
  daysContainer.innerHTML = "";
  daysContainer.style.width = "min(100%, 1240px)";
  daysContainer.style.maxWidth = "1240px";
  daysContainer.style.margin = "0 auto";
  const savedSelections = getSavedSelections();
  const groupedDays = groupExcursionsByDay(excursions);
  const bookingConfirmed = isBookingConfirmed(booking.booking_id);

  if (!groupedDays.length) {
    daysContainer.innerHTML = `
      <section class="card">
        <p>No excursions found for this cruise.</p>
      </section>
    `;
    return;
  }

  groupedDays.forEach((dayGroup, index) => {
    const section = document.createElement("section");
    section.className = `card day-group-card compact-day-group-card ${index % 2 === 0 ? "day-theme-light" : "day-theme-soft"}`;
    section.style.width = "100%";
    section.style.maxWidth = "1240px";
    section.style.margin = "12px auto";

    const includedHtml = renderExcursionCards(
      dayGroup.included,
      booking,
      savedSelections,
      bookingConfirmed
    );

    const masterpieceHtml = renderExcursionCards(
      dayGroup.masterpiece,
      booking,
      savedSelections,
      bookingConfirmed
    );

    const specialDinnerHtml = renderExcursionCards(
      dayGroup.specialDinner,
      booking,
      savedSelections,
      bookingConfirmed
    );

    section.innerHTML = `
      <div class="day-group-header compact-day-group-header">
        <div class="day-label">Day ${dayGroup.day_number}</div>
        <h2>${dayGroup.port}</h2>
      </div>

      <div class="excursion-section-block compact-section-block">
        <h3 class="excursion-group-title">Included Excursions</h3>
        <div class="excursion-list compact-excursion-list">
          ${includedHtml}
        </div>
      </div>

      ${
        dayGroup.masterpiece.length
          ? `
            <div class="excursion-section-block compact-section-block">
              <h3 class="excursion-group-title">Masterpiece Collection</h3>
              <div class="excursion-list compact-excursion-list">
                ${masterpieceHtml}
              </div>
            </div>
          `
          : ""
      }

      ${
        dayGroup.specialDinner.length
          ? `
            <div class="excursion-section-block compact-section-block">
              <h3 class="excursion-group-title">Special Dinners</h3>
              <div class="excursion-list compact-excursion-list">
                ${specialDinnerHtml}
              </div>
            </div>
          `
          : ""
      }
    `;

    daysContainer.appendChild(section);
  });

  document.querySelectorAll(".excursion-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", handleExcursionCheckboxChange);
  });

  updateTotalPrice();
  applyConfirmedStateUI();
  renderExistingConflictWarnings();
  renderGuestTotalsSummary();
}

async function loadExcursions() {
  try {
    const response = await fetch("/api/excursions");
    const rawItems = await response.json();
    const booking = getSavedBooking();

    const excursions = (Array.isArray(rawItems) ? rawItems : [])
      .filter((item) => isItemActive(item))
      .map((item) => normalizeExcursion(item))
      .filter((item) => item.day_number !== null)
      .filter((item) =>
        item.section === "included" ||
        item.section === "masterpiece" ||
        item.section === "special-dinner"
      )
      .filter((item) => item.excursion_name);

    renderDayTables(excursions, booking);
    excursionsSection.classList.remove("hidden");
  } catch (error) {
    daysContainer.innerHTML = `
      <section class="card">
        <p>Could not load excursions.</p>
      </section>
    `;
    excursionsSection.classList.remove("hidden");
  }
}

function showLoggedInView() {
  loginSection.classList.add("hidden");
  excursionsSection.classList.remove("hidden");
  setBookingHeader();
  loadExcursions();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const booking_id = document.getElementById("bookingId").value.trim();
  const last_name = document.getElementById("lastName").value.trim();

  loginMessage.textContent = "";
  confirmMessage.textContent = "";
  clearChargeAgreementMessage();

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ booking_id, last_name })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      loginMessage.textContent = data.message || "Login failed.";
      return;
    }

    localStorage.setItem("uniwappBooking", JSON.stringify(data.booking));

    const alreadySubmitted = await syncBookingFromServer(data.booking.booking_id);

    if (alreadySubmitted) {
      window.location.href = "my-tours.html";
      return;
    }

    showLoggedInView();
  } catch (error) {
    loginMessage.textContent = "Could not connect to the server.";
  }
});

confirmSelectionsBtn.addEventListener("click", async () => {
  const booking = getSavedBooking();

  if (!booking) {
    confirmMessage.textContent = "Please log in first.";
    return;
  }

  if (isBookingConfirmed(booking.booking_id)) {
    window.location.href = "my-tours.html";
    return;
  }

  const hasExistingConflicts = renderExistingConflictWarnings();

  if (hasExistingConflicts) {
    confirmMessage.textContent = "Please resolve the overlapping excursion selections before submitting.";
    return;
  }

  if (!chargeAgreementCheckbox || !chargeAgreementCheckbox.checked) {
    showChargeAgreementMessage("Please agree that this amount will be charged to your onboard account before submitting.");
    confirmMessage.textContent = "";
    return;
  }

  clearChargeAgreementMessage();

  const newSelections = [];
  const checkedBoxes = document.querySelectorAll(".excursion-checkbox:checked");

  checkedBoxes.forEach((checkbox) => {
    const excursion = getCheckboxExcursionData(checkbox);

    newSelections.push({
      booking_id: booking.booking_id,
      room_number: booking.room_number,
      guest_name: checkbox.dataset.guestName,
      excursion_name: excursion.excursion_name,
      port: excursion.port,
      day_number: excursion.day_number,
      start_time: excursion.start_time,
      end_time: excursion.end_time,
      price: Number(excursion.price || 0)
    });
  });

  try {
    confirmSelectionsBtn.disabled = true;
    confirmMessage.textContent = "Saving your selections...";

    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        booking: booking,
        selections: newSelections
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      confirmSelectionsBtn.disabled = false;
      confirmMessage.textContent = data.message || "Could not save your selections.";
      return;
    }

    saveSelectionsToLocal(booking.booking_id, newSelections);
    markBookingConfirmed(booking.booking_id);
    updateNavigationVisibility();
    clearInlineConflictMessages();
    clearChargeAgreementMessage();
    confirmMessage.textContent = "Your excursions have been confirmed. Redirecting to My Excursions...";

    setTimeout(() => {
      window.location.href = "my-tours.html";
    }, 700);
  } catch (error) {
    confirmSelectionsBtn.disabled = false;
    confirmMessage.textContent = "Server error. Please try again.";
  }
});

if (chargeAgreementCheckbox) {
  chargeAgreementCheckbox.addEventListener("change", () => {
    if (chargeAgreementCheckbox.checked) {
      clearChargeAgreementMessage();
    }
  });
}

function initSignupPage() {
  setBookingHeader();

  const savedBooking = getSavedBooking();

  if (savedBooking) {
    showLoggedInView();
  } else {
    updateNavigationVisibility();
  }
}

initSignupPage();