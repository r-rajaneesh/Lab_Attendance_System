import { Database } from "bun:sqlite";
import cookieParser from "cookie-parser";
import cors from "cors";
import cron from "cron";
import express from "express";
import fs from "fs-extra";
import helmet from "helmet";
import moment from "moment";

const app = express();
app.use(cors({ credentials: true, origin: ["http://127.0.0.1:4321", "http://localhost:4321"] }));
app.use(express.json());
app.use(helmet());
app.use(cookieParser());
const db = new Database("./database/lab_attendance_record.db", { create: true });
await fs.ensureDirSync("./database/");
db.run("PRAGMA journal_mode = WAL;");
db.run(
	"CREATE TABLE IF NOT EXISTS attendance (timestamp TEXT PRIMARY KEY, rollno TEXT, name TEXT, entrytime NUMBER, exittime NUMBER, purpose TEXT)",
);
db.run("CREATE TABLE IF NOT EXISTS login (username TEXT, password TEXT)");
db.run("CREATE TABLE IF NOT EXISTS loggedin (username TEXT, access_token TEXT, expiry_time TEXT)");

const checkAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
	const user_access_token = req.cookies["access_token"];
	const userdata = await db
		.query("SELECT * FROM loggedin WHERE access_token = ($user_access_token)")
		.get({ $user_access_token: user_access_token });
	console.log(userdata);
	if (!userdata) {
		res.status(401).json({ message: "Unauthorised" });
		return;
	}
	next();
};

// API Endpoints
app.post("/submit-attendance", async (req, res) => {
	// JSON.parse(req.body);
	let attendanceDetails = await req.body;
	console.log(attendanceDetails);
	await db
		.query(
			"INSERT INTO attendance (timestamp, rollno, name, entrytime, exittime, purpose) VALUES ($timestamp, $rollno, $name, $entrytime, $exittime, $purpose)",
		)
		.run({
			$timestamp: attendanceDetails["timestamp"],
			$rollno: attendanceDetails["attendance_rollno"],
			$name: attendanceDetails["attendance_name"],
			$entrytime: attendanceDetails["entry_time"],
			$exittime: attendanceDetails["exit_time"],
			$purpose: attendanceDetails["attendance_purpose"],
		});
	res.status(200).json({ message: "Done" });
});

app.get("/get-attendance", checkAuth, async (req, res) => {
	const startDateStr = req.query.startDate as string;
	const endDateStr = req.query.endDate as string;

	const startTimestamp = moment(startDateStr).startOf('day').utc().unix();
	const endTimestamp = moment(endDateStr).endOf('day').utc().unix();

	const data = await db
		.query("SELECT * FROM attendance WHERE entrytime >= $start_time AND entrytime <= $end_time")
		.all({
			$start_time: startTimestamp,
			$end_time: endTimestamp
		});

	res.status(200).json({ message: "Success", data });
});

app.post("/admin-login", async (req, res) => {
	const loginDetails: { login_username: string; login_password: string } = structuredClone(await req.body);

	const loginDetail: { username: string; password: string } = (await db
		.query(`SELECT * FROM login WHERE username = $username`)
		.get({ $username: loginDetails["login_username"] })) as { username: string; password: string };
	console.log(1, loginDetail);

	if (loginDetail.username === loginDetails.login_username && loginDetail.password === loginDetails.login_password) {
		const access_token = Bun.randomUUIDv7();
		await db
			.query(
				"INSERT INTO loggedin (username, access_token, expiry_time) VALUES ($username, $access_token, $expiry_time)",
			)
			.run({
				$username: loginDetail.username,
				$access_token: access_token,
				$expiry_time: moment().utc().add(1, "hour").unix(),
			});
		// await res.clearCookie("access_token");
		await res.cookie("access_token", access_token, {
			maxAge: 3600000, // 1 hour (1300ms is too short!)
			httpOnly: false,
			path: "/",
			sameSite: "lax",
			secure: false,
		});
		res.status(200).json({
			message: "Login Successful",
			redirectUrl: "http://localhost:4321/viewattendance",
		});
	} else await res.status(401).json({ message: "Invalid login details" });
});

app.post("/app-logout", async (req, res) => {
	const logoutDetails = await req.body;
	const { access_token } = logoutDetails;
	const [loggedIntime, username, token] = access_token.split("-");
	await db.query("DELETE FROM loggedin WHERE username = $username AND access_token = $access_token").run({
		$username: username,
		$access_token: token,
	});
	await res.clearCookie("access_token");
	res.status(200).json({ message: "Logout successfully" });
});

app.listen(5432, "0.0.0.0", () => {
	const clearExpiredAccessTokenJob = new cron.CronJob("* * * * *", async () => {
		await db
			.query("DELETE FROM loggedin WHERE expiry_time < ($current_time)")
			.run({ $current_time: moment().utc().unix() });
	});
	clearExpiredAccessTokenJob.start();
	console.log("Attendance Portal running on http://localhost:5432");
});
