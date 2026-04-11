const roomText = document.getElementById("roomText");
const tourList = document.getElementById("tourList");
const myToursActions = document.getElementById("myToursActions");
const requestChangeBtn = document.getElementById("requestChangeBtn");

function goToOverview() {
  window.location.href = "index.html";
}

function goToSignup() {
  window.location.href = "signup.html";
}

function goToMyTours() {
  window.location.href = "my-tours.html";
}

function logout() {
  localStorage.removeItem("uniwappBooking");
  localStorage.removeItem("uniwappSelections");
  window.location.href = "index.html";
}

function showChangesMessage() {
  alert(
    "Your excursions have already been submitted. Please contact the Reception if you need to make any changes."
  );
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
  return getConfirmedBookings().includes(String(bookingId));
}

function setElementVisibility(id, shouldShow) {
  const element = document.getElementById(id);

  if (element) {
    element.style.display = shouldShow ? "" : "none";
  }
}

function updateNavigationVisibility() {
  const booking = getSavedBooking();

  if (!booking) {
    setElementVisibility("signupNavItem", true);
    setElementVisibility("signupSeparator", true);
    setElementVisibility("myToursNavItem", false);
    setElementVisibility("myToursSeparator", false);
    return;
  }

  const confirmed = isBookingConfirmed(booking.booking_id);

  setElementVisibility("signupNavItem", !confirmed);
  setElementVisibility("signupSeparator", !confirmed);
  setElementVisibility("myToursNavItem", confirmed);
  setElementVisibility("myToursSeparator", confirmed);
}

function setHeader() {
  const booking = getSavedBooking();

  if (booking) {
    roomText.textContent = `Booking ${booking.booking_id} • Room ${booking.room_number}`;
  } else {
    roomText.textContent = "";
  }
}

function setRequestChangeVisibility(shouldShow) {
  if (!requestChangeBtn) {
    return;
  }

  requestChangeBtn.style.display = shouldShow ? "" : "none";
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

function getTimePeriodLabel(startTime, endTime) {
  const startMinutes = convertTo24Hour(startTime);
  const endMinutes = convertTo24Hour(endTime);
  const noon = 12 * 60;

  if (startMinutes !== null && endMinutes !== null) {
    if (startMinutes < noon && endMinutes > noon) {
      return "Full day";
    }

    if (startMinutes >= noon) {
      return "PM";
    }

    return "AM";
  }

  if (startMinutes !== null) {
    return startMinutes >= noon ? "PM" : "AM";
  }

  if (endMinutes !== null) {
    return endMinutes > noon ? "PM" : "AM";
  }

  return "Full day";
}

function sortSelections(selections) {
  return [...selections].sort((a, b) => {
    const dayA = Number(a.day_number || 0);
    const dayB = Number(b.day_number || 0);

    if (dayA !== dayB) {
      return dayA - dayB;
    }

    const timeA = convertTo24Hour(a.start_time);
    const timeB = convertTo24Hour(b.start_time);

    if (timeA !== null && timeB !== null && timeA !== timeB) {
      return timeA - timeB;
    }

    return String(a.excursion_name || "").localeCompare(String(b.excursion_name || ""));
  });
}

function groupSelectionsByDay(selections) {
  const grouped = {};

  sortSelections(selections).forEach((selection) => {
    const dayKey = `${selection.day_number}__${selection.port}`;

    if (!grouped[dayKey]) {
      grouped[dayKey] = {
        day_number: selection.day_number,
        port: selection.port,
        guests: {}
      };
    }

    const guestName = selection.guest_name || "Unknown Guest";

    if (!grouped[dayKey].guests[guestName]) {
      grouped[dayKey].guests[guestName] = [];
    }

    grouped[dayKey].guests[guestName].push(selection);
  });

  return Object.values(grouped).sort(
    (a, b) => Number(a.day_number) - Number(b.day_number)
  );
}

function formatPrice(value) {
  const amount = Number(value || 0);
  return amount > 0 ? `€${amount}` : "Included";
}

function formatTotalPrice(value) {
  return `€${Number(value || 0)}`;
}

function calculateTotal(selections) {
  return selections.reduce((sum, item) => sum + Number(item.price || 0), 0);
}

function renderSelections() {
  const booking = getSavedBooking();

  if (!booking) {
    setRequestChangeVisibility(false);

    tourList.innerHTML = `
      <div class="empty-state">
        <p>You are not logged in yet.</p>
        <p>Please go to <strong>Select My Tours</strong> first.</p>
        <div class="actions-row">
          <button class="app-btn secondary" onclick="goToSignup()">Go to Select My Tours</button>
        </div>
      </div>
    `;
    return;
  }

  if (!isBookingConfirmed(booking.booking_id)) {
    setRequestChangeVisibility(false);

    tourList.innerHTML = `
      <div class="empty-state">
        <p>Your excursions have not been submitted yet.</p>
        <p>Please complete your selection first.</p>
        <div class="actions-row">
          <button class="app-btn secondary" onclick="goToSignup()">Go to Select My Tours</button>
        </div>
      </div>
    `;
    return;
  }

  const allSelections = getSavedSelections();
  const bookingSelections = allSelections.filter(
    (selection) => String(selection.booking_id) === String(booking.booking_id)
  );

  if (!bookingSelections.length) {
    setRequestChangeVisibility(false);

    tourList.innerHTML = `
      <div class="empty-state">
        <p>No excursions selected yet.</p>
      </div>
    `;
    return;
  }

  setRequestChangeVisibility(true);

  const groupedDays = groupSelectionsByDay(bookingSelections);
  const total = calculateTotal(bookingSelections);

  tourList.innerHTML = groupedDays
    .map((dayGroup, index) => {
      const guestSections = Object.entries(dayGroup.guests)
        .map(([guestName, items]) => {
          const rowsHtml = items
            .map((item) => {
              const timeText = getTimePeriodLabel(item.start_time, item.end_time);

              return `
                <tr>
                  <td class="excursion-name-cell col-excursion">${item.excursion_name || ""}</td>
                  <td class="time-cell col-time">${timeText}</td>
                  <td class="col-price">${formatPrice(item.price)}</td>
                </tr>
              `;
            })
            .join("");

          return `
            <div class="guest-section">
              <h3>Guest: ${guestName}</h3>
              <div class="table-wrap">
                <table class="excursions-table">
                  <thead>
                    <tr>
                      <th class="col-excursion">Excursion</th>
                      <th class="col-time">Time</th>
                      <th class="col-price">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rowsHtml}
                  </tbody>
                </table>
              </div>
            </div>
          `;
        })
        .join("");

      return `
        <section class="card my-tours-day-card ${index % 2 === 0 ? "day-theme-light" : "day-theme-soft"}">
          <div class="day-group-header">
            <div class="day-label">Day ${dayGroup.day_number}</div>
            <h2>${dayGroup.port || ""}</h2>
          </div>
          ${guestSections}
        </section>
      `;
    })
    .join("");

  tourList.innerHTML += `
    <section class="card total-card">
      <div class="total-card-inner">
        <div class="total-text-block">
          <h2>Total</h2>
          <p class="total-subtext">This amount will be charged at the end of the cruise.</p>
          <p class="important-note">
            Please note that Masterpiece Collection excursion reservations are non-refundable once submitted.
          </p>
        </div>
        <div class="total-price-box">
          <span>Total</span>
          <strong>${formatTotalPrice(total)}</strong>
        </div>
      </div>
    </section>
  `;
}

function initMyToursPage() {
  updateNavigationVisibility();
  setHeader();
  renderSelections();
}

initMyToursPage();