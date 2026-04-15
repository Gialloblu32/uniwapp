const express = require("express");
const cors = require("cors");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ACTIVE_CRUISE_CODE = "SC26XXXX";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const submissionsFile = path.join(__dirname, "data", "submissions.json");

function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
}

function readSubmissions() {
  try {
    const fileContent = fs.readFileSync(submissionsFile, "utf8");
    return JSON.parse(fileContent);
  } catch (error) {
    return [];
  }
}

function writeSubmissions(submissions) {
  if (!fs.existsSync(submissionsFile)) {
    fs.writeFileSync(submissionsFile, "[]", "utf8");
  }

  fs.writeFileSync(submissionsFile, JSON.stringify(submissions, null, 2), "utf8");
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeLower(value) {
  return normalizeString(value).toLowerCase();
}

function isActiveCruiseCode(value) {
  return normalizeLower(value) === normalizeLower(ACTIVE_CRUISE_CODE);
}

async function getActiveGuests() {
  const guests = await getGuests();
  return guests.filter((item) => isActiveCruiseCode(item.cruise_code));
}

function buildRoomMapFromGuests(guestRows) {
  const roomMap = new Map();

  guestRows.forEach((row) => {
    const bookingId = normalizeString(row.booking_id);
    const roomNumber = normalizeString(row.room_number);

    if (!bookingId || !roomNumber) {
      return;
    }

    if (!roomMap.has(bookingId)) {
      roomMap.set(bookingId, {
        booking_id: bookingId,
        room_number: roomNumber,
        submitted: false,
        submitted_at: null
      });
    }
  });

  return roomMap;
}

function markRoomSubmissions(roomMap, submissions) {
  submissions.forEach((submission) => {
    const bookingId = normalizeString(submission.booking_id);

    if (!roomMap.has(bookingId)) {
      return;
    }

    const room = roomMap.get(bookingId);
    const selections = Array.isArray(submission.selections)
      ? submission.selections
      : [];

    if (selections.length > 0) {
      room.submitted = true;
      room.submitted_at = submission.submitted_at || null;
    }
  });
}

function getSelectionCountMap(submissions) {
  const map = new Map();

  submissions.forEach((submission) => {
    const selections = Array.isArray(submission.selections)
      ? submission.selections
      : [];

    selections.forEach((selection) => {
      const key = [
        normalizeString(selection.day_number),
        normalizeString(selection.port).toLowerCase(),
        normalizeString(selection.excursion_name).toLowerCase()
      ].join("__");

      map.set(key, (map.get(key) || 0) + 1);
    });
  });

  return map;
}

function findBookingRow(guests, bookingId, lastName) {
  const normalizedBookingId = normalizeLower(bookingId);
  const normalizedLastName = normalizeLower(lastName);

  return guests.find((row) => {
    if (normalizeLower(row.booking_id) !== normalizedBookingId) {
      return false;
    }

    if (!isActiveCruiseCode(row.cruise_code)) {
      return false;
    }

    if (!normalizedLastName) {
      return true;
    }

    const guest1Last = normalizeLower(row.guest_1_last_name);
    const guest2Last = normalizeLower(row.guest_2_last_name);

    return guest1Last === normalizedLastName || guest2Last === normalizedLastName;
  });
}

async function getGuests() {
  return await readCsv(path.join(__dirname, "data", "guests.csv"));
}

async function getExcursions() {
  return await readCsv(path.join(__dirname, "data", "excursions.csv"));
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

function normalizeReceptionExcursion(item) {
  return {
    day_number: getDayNumber(item),
    port: getCity(item),
    section: getSection(item),
    excursion_name: getName(item),
    price: getPrice(item)
  };
}

function getReceptionVisibleExcursions(rawExcursions) {
  return rawExcursions
    .filter((item) => isItemActive(item))
    .map((item) => normalizeReceptionExcursion(item))
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

app.get("/api/guests", async (req, res) => {
  try {
    const guests = await getActiveGuests();
    res.json(guests);
  } catch (error) {
    res.status(500).json({ error: "Failed to load guests" });
  }
});

app.get("/api/excursions", async (req, res) => {
  try {
    const excursions = await getExcursions();

    const cleaned = excursions
      .map((item) => ({
        day: item.day?.trim() || "",
        city: item.city?.trim() || "",
        section: item.section?.trim().toLowerCase() || "",
        name: item.name?.trim() || "",
        start_time: item.start_time?.trim() || "",
        end_time: item.end_time?.trim() || "",
        price: item.price?.trim() || "",
        capacity_min: item.capacity_min?.trim() || "",
        capacity_max: item.capacity_max?.trim() || "",
        description: item.description?.trim() || "",
        status: item.status?.trim().toLowerCase() || ""
      }))
      .filter((item) => item.day && item.city && item.section && item.name);

    res.json(cleaned);
  } catch (error) {
    res.status(500).json({ error: "Failed to load excursions" });
  }
});

app.get("/api/submissions", (req, res) => {
  try {
    const submissions = readSubmissions();
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ error: "Failed to load submissions" });
  }
});

app.get("/api/reception/rooms", async (req, res) => {
  try {
    const activeGuests = await getActiveGuests();
    const submissions = readSubmissions();

    const roomMap = buildRoomMapFromGuests(activeGuests);
    markRoomSubmissions(roomMap, submissions);

    const rooms = Array.from(roomMap.values()).sort((a, b) => {
      const roomA = Number(a.room_number);
      const roomB = Number(b.room_number);

      if (!Number.isNaN(roomA) && !Number.isNaN(roomB)) {
        return roomA - roomB;
      }

      return String(a.room_number).localeCompare(String(b.room_number));
    });

    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: "Failed to load reception rooms" });
  }
});

app.get("/api/reception/room", async (req, res) => {
  try {
    const bookingId = normalizeString(req.query.booking_id);

    if (!bookingId) {
      return res.status(400).json({ error: "booking_id is required" });
    }

    const guests = await getActiveGuests();
    const submissions = readSubmissions();

    const bookingRow = findBookingRow(guests, bookingId);

    if (!bookingRow) {
      return res.status(404).json({ error: "Room not found" });
    }

    const matchingSelections = [];
    let submittedAt = null;

    submissions.forEach((submission) => {
      const selections = Array.isArray(submission.selections)
        ? submission.selections
        : [];

      const foundSelections = selections.filter(
        (sel) => normalizeString(sel.booking_id) === bookingId
      );

      if (foundSelections.length > 0) {
        matchingSelections.push(...foundSelections);

        if (!submittedAt && submission.submitted_at) {
          submittedAt = submission.submitted_at;
        }
      }
    });

    const guestsInRoom = [];

    if (bookingRow.guest_1_first_name && bookingRow.guest_1_last_name) {
      guestsInRoom.push(
        `${normalizeString(bookingRow.guest_1_first_name)} ${normalizeString(
          bookingRow.guest_1_last_name
        )}`.trim()
      );
    }

    if (bookingRow.guest_2_first_name && bookingRow.guest_2_last_name) {
      guestsInRoom.push(
        `${normalizeString(bookingRow.guest_2_first_name)} ${normalizeString(
          bookingRow.guest_2_last_name
        )}`.trim()
      );
    }

    res.json({
      booking_id: normalizeString(bookingRow.booking_id),
      room_number: normalizeString(bookingRow.room_number),
      cruise_code: normalizeString(bookingRow.cruise_code),
      guests: guestsInRoom,
      submitted: matchingSelections.length > 0,
      submitted_at: submittedAt,
      selections: matchingSelections
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load room details" });
  }
});

app.get("/api/reception/excursion-totals", async (req, res) => {
  try {
    const activeGuests = await getActiveGuests();
    const rawExcursions = await getExcursions();
    const submissions = readSubmissions();

    const roomMap = buildRoomMapFromGuests(activeGuests);
    markRoomSubmissions(roomMap, submissions);

    const rooms = Array.from(roomMap.values());
    const submittedRooms = rooms.filter((room) => room.submitted).length;

    const excursions = getReceptionVisibleExcursions(rawExcursions);
    const selectionCountMap = getSelectionCountMap(submissions);

    const totals = excursions
      .map((excursion) => {
        const key = [
          normalizeString(excursion.day_number),
          normalizeString(excursion.port).toLowerCase(),
          normalizeString(excursion.excursion_name).toLowerCase()
        ].join("__");

        return {
          day_number: excursion.day_number,
          port: excursion.port,
          section: excursion.section,
          excursion_name: excursion.excursion_name,
          price: excursion.price,
          total_selected: selectionCountMap.get(key) || 0
        };
      })
      .sort((a, b) => {
        const dayA = Number(a.day_number || 0);
        const dayB = Number(b.day_number || 0);

        if (dayA !== dayB) {
          return dayA - dayB;
        }

        const portCompare = String(a.port || "").localeCompare(String(b.port || ""));
        if (portCompare !== 0) {
          return portCompare;
        }

        return String(a.excursion_name || "").localeCompare(String(b.excursion_name || ""));
      });

    res.json({
      cruise_code: ACTIVE_CRUISE_CODE,
      summary: {
        total_rooms: rooms.length,
        submitted_rooms: submittedRooms,
        pending_rooms: rooms.length - submittedRooms
      },
      totals: totals
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load excursion totals" });
  }
});

app.get("/api/reception/excursions-by-guest", async (req, res) => {
  try {
    const activeGuests = await getActiveGuests();
    const submissions = readSubmissions();

    const activeBookingIds = new Set(
      activeGuests
        .map((guest) => normalizeString(guest.booking_id))
        .filter(Boolean)
    );

    // Build room map with guest names from the CSV guest record
    const roomMap = new Map();
    activeGuests.forEach((guestRow) => {
      const bookingId = normalizeString(guestRow.booking_id);
      const roomNumber = normalizeString(guestRow.room_number);

      if (!bookingId || !roomNumber) return;

      if (!roomMap.has(roomNumber)) {
        roomMap.set(roomNumber, {
          room_number: roomNumber,
          guests: new Map()
        });
      }

      const guestNames = [];
      const guest1First = normalizeString(guestRow.guest_1_first_name || guestRow.guest1_first_name || guestRow['guest 1 first name']);
      const guest1Last = normalizeString(guestRow.guest_1_last_name || guestRow.guest1_last_name || guestRow['guest 1 last name']);
      if (guest1First || guest1Last) {
        guestNames.push(`${guest1First} ${guest1Last}`.trim());
      }

      const guest2First = normalizeString(guestRow.guest_2_first_name || guestRow.guest2_first_name || guestRow['guest 2 first name']);
      const guest2Last = normalizeString(guestRow.guest_2_last_name || guestRow.guest2_last_name || guestRow['guest 2 last name']);
      if (guest2First || guest2Last) {
        guestNames.push(`${guest2First} ${guest2Last}`.trim());
      }

      if (guestNames.length === 0) {
        const fallbackName = normalizeString(guestRow.guest_name || guestRow.full_name || guestRow['guest name']);
        if (fallbackName) {
          guestNames.push(fallbackName);
        }
      }

      const room = roomMap.get(roomNumber);
      guestNames.forEach((guestName) => {
        if (!room.guests.has(guestName)) {
          room.guests.set(guestName, {
            guest_name: guestName,
            booking_id: bookingId,
            excursions: []
          });
        }
      });
    });

    const bookingRoomMap = new Map();
    activeGuests.forEach((guestRow) => {
      const bookingId = normalizeString(guestRow.booking_id);
      const roomNumber = normalizeString(guestRow.room_number);
      if (bookingId && roomNumber) {
        bookingRoomMap.set(bookingId, roomNumber);
      }
    });

    // Add excursions
    submissions.forEach((submission) => {
      const bookingId = normalizeString(submission.booking_id);
      if (!activeBookingIds.has(bookingId)) return;

      const roomNumber = bookingRoomMap.get(bookingId);
      if (!roomNumber || !roomMap.has(roomNumber)) return;

      const room = roomMap.get(roomNumber);
      const selections = Array.isArray(submission.selections) ? submission.selections : [];

      selections.forEach((selection) => {
        const guestName = normalizeString(selection.guest_name) || "";
        let guest = room.guests.get(guestName);

        if (!guest && room.guests.size === 1) {
          guest = room.guests.values().next().value;
        }

        if (!guest) {
          return;
        }

        guest.excursions.push({
          day_number: normalizeString(selection.day_number),
          port: normalizeString(selection.port),
          excursion_name: normalizeString(selection.excursion_name),
          price: normalizeString(selection.price),
          start_time: normalizeString(selection.start_time),
          end_time: normalizeString(selection.end_time),
          section: normalizeString(selection.section)
        });
      });
    });

    // Convert to array and sort
    const rooms = Array.from(roomMap.values()).map(room => ({
      room_number: room.room_number,
      guests: Array.from(room.guests.values()).map(guest => ({
        ...guest,
        excursions: guest.excursions.sort((a, b) => {
          const dayA = Number(a.day_number || 0);
          const dayB = Number(b.day_number || 0);
          if (dayA !== dayB) return dayA - dayB;
          return String(a.excursion_name || "").localeCompare(String(b.excursion_name || ""));
        })
      })).sort((a, b) => a.guest_name.localeCompare(b.guest_name))
    })).sort((a, b) => a.room_number.localeCompare(b.room_number));

    res.json({
      cruise_code: ACTIVE_CRUISE_CODE,
      rooms: rooms
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load excursions by guest" });
  }
});

app.post("/api/submissions", (req, res) => {
  try {
    const { booking, selections } = req.body;

    if (!booking || !Array.isArray(selections)) {
      return res.status(400).json({
        success: false,
        message: "booking and selections are required"
      });
    }

    const submissions = readSubmissions();

    const filteredSubmissions = submissions.filter(
      (item) => String(item.booking_id) !== String(booking.booking_id)
    );

    const newSubmission = {
      booking_id: booking.booking_id,
      room_number: booking.room_number,
      cruise_code: booking.cruise_code,
      guests: booking.guests || [],
      selections: selections,
      submitted_at: new Date().toISOString()
    };

    filteredSubmissions.push(newSubmission);
    writeSubmissions(filteredSubmissions);

    res.json({
      success: true,
      message: "Submission saved"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to save submission"
    });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { booking_id, last_name } = req.body;

    if (!booking_id || !last_name) {
      return res.status(400).json({
        success: false,
        message: "booking_id and last_name are required"
      });
    }

    const guests = await getActiveGuests();
    const booking = findBookingRow(guests, booking_id, last_name);

    if (!booking) {
      return res.status(401).json({
        success: false,
        message: "Invalid booking details"
      });
    }

    const guestsInRoom = [];

    if (booking.guest_1_first_name && booking.guest_1_last_name) {
      guestsInRoom.push({
        first_name: normalizeString(booking.guest_1_first_name),
        last_name: normalizeString(booking.guest_1_last_name),
        full_name: `${normalizeString(booking.guest_1_first_name)} ${normalizeString(
          booking.guest_1_last_name
        )}`
      });
    }

    if (booking.guest_2_first_name && booking.guest_2_last_name) {
      guestsInRoom.push({
        first_name: normalizeString(booking.guest_2_first_name),
        last_name: normalizeString(booking.guest_2_last_name),
        full_name: `${normalizeString(booking.guest_2_first_name)} ${normalizeString(
          booking.guest_2_last_name
        )}`
      });
    }

    res.json({
      success: true,
      booking: {
        cruise_code: normalizeString(booking.cruise_code),
        booking_id: normalizeString(booking.booking_id),
        room_number: normalizeString(booking.room_number),
        guests: guestsInRoom
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

app.get("/api/active-cruise", (req, res) => {
  res.json({ cruise_code: ACTIVE_CRUISE_CODE });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});