import express from "express";
import cors from "cors";
import helmet from "helmet";
import moment from "moment";
const app = express();
const sql = new Bun.SQL("sqlite://attendance.db", {
	prepare: false,
});
app.use(cors(), helmet(), express.json(), express.text());
sql.connect();
app.post("/attendance", async (req, res) => {
	const body = req.body;
	const roll = body.rollnumber;
	const system = body.systemnumber ?? "Not specified";
	const reason = body.reason ?? "Not specified";
	console.log(roll, system, reason);
	await sql`INSERT INTO attendance VALUES (${moment().unix()}, ${roll}, ${system}, ${reason})`;
	res.json({ status: 200, body: { message: "Recieved Attendance" } });
});
app.listen(80, "0.0.0.0", async () => {
	// Enable foreign keys
	await sql`PRAGMA foreign_keys = ON`;

	// Set journal mode to WAL for better concurrency
	await sql`PRAGMA journal_mode = WAL`;
	await sql`
    CREATE TABLE IF NOT EXISTS attendance (
        time TEXT NOT NULL,
        rollno TEXT,
        sysno TEXT,
        reason TEXT
    );
    `;
	console.log("Attendance Dashboard running on http://127.0.0.1");
});
