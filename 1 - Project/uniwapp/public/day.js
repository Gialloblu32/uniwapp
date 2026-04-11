const booking = JSON.parse(localStorage.getItem("uniwappBooking"));
const roomText = document.getElementById("roomText");

if (roomText) {
  roomText.textContent = booking?.room_number ? `Room: ${booking.room_number}` : "";
}

const params = new URLSearchParams(window.location.search);
let currentDay = parseInt(params.get("day"), 10) || 1;

if (currentDay < 1) {
  currentDay = 1;
}

if (currentDay > 8) {
  currentDay = 8;
}

function goToPreviousDay() {
  if (currentDay > 1) {
    window.location.href = `day.html?day=${currentDay - 1}`;
  }
}

function goToNextDay() {
  if (currentDay < 8) {
    window.location.href = `day.html?day=${currentDay + 1}`;
  }
}

function goToOverview() {
  window.location.href = "index.html";
}

function goToSignup() {
  window.location.href = "signup.html";
}

function goToMyTours() {
  window.location.href = "my-tours.html";
}

function scrollToTopPage() {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function getSavedBooking() {
  return JSON.parse(localStorage.getItem("uniwappBooking"));
}

function getConfirmedBookings() {
  return JSON.parse(localStorage.getItem("uniwappConfirmedBookings")) || [];
}

function isCurrentBookingConfirmed() {
  const savedBooking = getSavedBooking();

  if (!savedBooking) {
    return false;
  }

  return getConfirmedBookings().includes(String(savedBooking.booking_id));
}

function setElementVisibility(id, shouldShow) {
  const element = document.getElementById(id);

  if (element) {
    element.style.display = shouldShow ? "" : "none";
  }
}

function updateNavigationVisibility() {
  const savedBooking = getSavedBooking();
  const isConfirmed = isCurrentBookingConfirmed();

  if (!savedBooking) {
    setElementVisibility("signupNavItem", true);
    setElementVisibility("signupSeparator", true);
    setElementVisibility("myToursNavItem", false);
    setElementVisibility("myToursSeparator", false);
    return;
  }

  setElementVisibility("signupNavItem", !isConfirmed);
  setElementVisibility("signupSeparator", !isConfirmed);
  setElementVisibility("myToursNavItem", isConfirmed);
  setElementVisibility("myToursSeparator", isConfirmed);
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

function getDescription(item) {
  return getFieldValue(item, ["description", "Description"]);
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

function normalizeItem(item) {
  return {
    day: getDayNumber(item),
    city: getCity(item),
    section: getSection(item),
    name: getName(item),
    start_time: getStartTime(item),
    end_time: getEndTime(item),
    price: getPrice(item),
    capacity_min: getMinCapacity(item),
    capacity_max: getMaxCapacity(item),
    description: getDescription(item)
  };
}

function formatPrice(value) {
  const cleaned = String(value || "").trim();

  if (!cleaned) {
    return "Included";
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
  if (Number.isNaN(number) || number <= 0) {
    return "—";
  }

  return number;
}

function formatMax(value) {
  const cleaned = String(value || "").trim();

  if (!cleaned) {
    return "—";
  }

  const number = Number(cleaned);
  if (Number.isNaN(number) || number <= 0) {
    return "—";
  }

  return number;
}

function setSectionVisibility(sectionId, shouldShow) {
  const section = document.getElementById(sectionId);

  if (section) {
    section.style.display = shouldShow ? "block" : "none";
  }
}

function getTimeLabel(start_time, end_time) {
  if (!start_time || !end_time) {
    return "Time to be announced";
  }

  const startIsAM = String(start_time).toUpperCase().includes("AM");
  const endIsAM = String(end_time).toUpperCase().includes("AM");
  const startIsPM = String(start_time).toUpperCase().includes("PM");
  const endIsPM = String(end_time).toUpperCase().includes("PM");

  if (startIsAM && endIsAM) {
    return "AM";
  }

  if (startIsPM && endIsPM) {
    return "PM";
  }

  return "Full day";
}

function renderItems(containerId, items, emptyMessage) {
  const container = document.getElementById(containerId);

  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!items.length) {
    container.innerHTML = `<p class="info-text">${emptyMessage}</p>`;
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "excursion-row";

    const timeLabel = getTimeLabel(item.start_time, item.end_time);

    const minText = formatMin(item.capacity_min);
    const maxText = formatMax(item.capacity_max);
    const minMaxHtml =
      minText !== "—" || maxText !== "—"
        ? `<span><strong>Min / Max:</strong> ${minText} / ${maxText}</span>`
        : "";

    row.innerHTML = `
      <div class="excursion-name">${item.name}</div>
      <div class="excursion-meta">
        <span><strong>Time:</strong> ${timeLabel}</span>
        <span><strong>Price:</strong> ${formatPrice(item.price)}</span>
        ${minMaxHtml}
      </div>
    `;

    container.appendChild(row);
  });
}

async function loadDayData() {
  try {
    const response = await fetch("/api/excursions");

    if (!response.ok) {
      throw new Error("Failed to load excursions");
    }

    const rawItems = await response.json();

    const items = (Array.isArray(rawItems) ? rawItems : [])
      .filter((item) => isItemActive(item))
      .map((item) => normalizeItem(item))
      .filter((item) => item.day === currentDay);

    const dayTitle = document.getElementById("dayTitle");

    const city = items.find((item) => item.city)?.city || "";

    dayTitle.textContent = city ? `Day ${currentDay} – ${city}` : `Day ${currentDay}`;

    const includedItems = items.filter((item) => item.section === "included");
    const masterpieceItems = items.filter((item) => item.section === "masterpiece");
    const specialDinnerItems = items.filter((item) => item.section === "special-dinner");
    const onboardItems = items.filter((item) => item.section === "onboard");

    setSectionVisibility("includedSection", includedItems.length > 0);
    setSectionVisibility("masterpieceSection", masterpieceItems.length > 0);
    setSectionVisibility("specialDinnerSection", specialDinnerItems.length > 0);
    setSectionVisibility("onboardSection", onboardItems.length > 0);

    renderItems("includedList", includedItems, "No included excursions for this day.");
    renderItems("masterpieceList", masterpieceItems, "No Masterpiece Collection excursions for this day.");
    renderItems("specialDinnerList", specialDinnerItems, "No special dinners for this day.");
    renderItems("onboardList", onboardItems, "No onboard activities for this day.");
  } catch (error) {
    console.error("Could not load day information.", error);
  }
}

updateNavigationVisibility();
loadDayData();