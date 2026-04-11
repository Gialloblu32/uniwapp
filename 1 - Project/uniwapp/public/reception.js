const cruiseCodeText = document.getElementById("cruiseCodeText");
const totalRoomsElement = document.getElementById("totalRooms");
const submittedRoomsElement = document.getElementById("submittedRooms");
const pendingRoomsElement = document.getElementById("pendingRooms");
const roomsTableBody = document.getElementById("roomsTableBody");

function goToReceptionTotals() {
  window.location.href = "reception-totals.html";
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

function getStatusBadge(submitted) {
  if (submitted) {
    return '<span class="status-badge status-submitted">Submitted</span>';
  }

  return '<span class="status-badge status-pending">Pending</span>';
}

function renderSummary(rooms) {
  const totalRooms = rooms.length;
  const submittedRooms = rooms.filter((room) => room.submitted).length;
  const pendingRooms = totalRooms - submittedRooms;

  totalRoomsElement.textContent = String(totalRooms);
  submittedRoomsElement.textContent = String(submittedRooms);
  pendingRoomsElement.textContent = String(pendingRooms);
}

function sortRoomsBySubmissionTime(rooms) {
  return [...rooms].sort((a, b) => {
    if (a.submitted && !b.submitted) {
      return -1;
    }

    if (!a.submitted && b.submitted) {
      return 1;
    }

    if (a.submitted && b.submitted) {
      const timeA = new Date(a.submitted_at).getTime();
      const timeB = new Date(b.submitted_at).getTime();

      if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeA !== timeB) {
        return timeA - timeB;
      }
    }

    const roomA = Number(a.room_number);
    const roomB = Number(b.room_number);

    if (!Number.isNaN(roomA) && !Number.isNaN(roomB)) {
      return roomA - roomB;
    }

    return String(a.room_number || "").localeCompare(String(b.room_number || ""));
  });
}

function openRoom(bookingId) {
  if (!bookingId) {
    return;
  }

  window.location.href = `reception-room.html?booking_id=${encodeURIComponent(bookingId)}`;
}

function renderRoomsTable(rooms) {
  if (!Array.isArray(rooms) || rooms.length === 0) {
    roomsTableBody.innerHTML = `
      <tr>
        <td colspan="4">No rooms found.</td>
      </tr>
    `;
    return;
  }

  const sortedRooms = sortRoomsBySubmissionTime(rooms);

  roomsTableBody.innerHTML = sortedRooms
    .map((room) => {
      const bookingId = String(room.booking_id || "").replace(/"/g, "&quot;");

      return `
        <tr class="clickable-row" data-booking-id="${bookingId}">
          <td>${room.room_number || ""}</td>
          <td>${room.booking_id || ""}</td>
          <td>${getStatusBadge(room.submitted)}</td>
          <td>${formatSubmittedAt(room.submitted_at)}</td>
        </tr>
      `;
    })
    .join("");

  document.querySelectorAll(".clickable-row").forEach((row) => {
    row.addEventListener("click", () => {
      openRoom(row.dataset.bookingId);
    });
  });
}

async function loadCruiseCode() {
  try {
    const response = await fetch("/api/active-cruise");
    const data = await response.json();

    if (!response.ok || !data.cruise_code) {
      cruiseCodeText.textContent = "";
      return;
    }

    cruiseCodeText.textContent = `Cruise ${data.cruise_code}`;
  } catch (error) {
    cruiseCodeText.textContent = "";
  }
}

async function loadRooms() {
  try {
    const response = await fetch("/api/reception/rooms");
    const rooms = await response.json();

    if (!response.ok || !Array.isArray(rooms)) {
      roomsTableBody.innerHTML = `
        <tr>
          <td colspan="4">Could not load rooms.</td>
        </tr>
      `;
      return;
    }

    renderSummary(rooms);
    renderRoomsTable(rooms);
  } catch (error) {
    roomsTableBody.innerHTML = `
      <tr>
        <td colspan="4">Could not load rooms.</td>
      </tr>
    `;
  }
}

async function initReceptionPage() {
  await loadCruiseCode();
  await loadRooms();
}

initReceptionPage();