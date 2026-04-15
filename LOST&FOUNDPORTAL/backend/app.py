from __future__ import annotations

import json
import secrets
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory


BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
DATABASE_PATH = Path(__file__).resolve().parent / "portal.db"

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.executescript(
            """
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS lost_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_name TEXT NOT NULL,
                category TEXT NOT NULL,
                description TEXT NOT NULL,
                location TEXT NOT NULL,
                owner_name TEXT NOT NULL,
                contact_info TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Open',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS found_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_name TEXT NOT NULL,
                category TEXT NOT NULL,
                description TEXT NOT NULL,
                location TEXT NOT NULL,
                finder_name TEXT NOT NULL,
                finder_contact TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Awaiting Verification',
                created_at TEXT NOT NULL,
                access_key TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS verification_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                found_item_id INTEGER NOT NULL,
                question_text TEXT NOT NULL,
                answer_text TEXT NOT NULL,
                FOREIGN KEY (found_item_id) REFERENCES found_items(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS claims (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                found_item_id INTEGER NOT NULL,
                claimant_name TEXT NOT NULL,
                claimant_contact TEXT NOT NULL,
                claimant_message TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Pending Review',
                created_at TEXT NOT NULL,
                FOREIGN KEY (found_item_id) REFERENCES found_items(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS claim_answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                claim_id INTEGER NOT NULL,
                question_id INTEGER NOT NULL,
                answer_text TEXT NOT NULL,
                FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE CASCADE,
                FOREIGN KEY (question_id) REFERENCES verification_questions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                type TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )
        connection.commit()


def add_notification(connection: sqlite3.Connection, title: str, message: str, item_type: str) -> None:
    connection.execute(
        """
        INSERT INTO notifications (title, message, type, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (title, message, item_type, utc_now()),
    )


def serialize_lost_item(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "item_name": row["item_name"],
        "category": row["category"],
        "description": row["description"],
        "location": row["location"],
        "owner_name": row["owner_name"],
        "contact_info": row["contact_info"],
        "status": row["status"],
        "created_at": row["created_at"],
    }


def serialize_found_item_public(connection: sqlite3.Connection, row: sqlite3.Row) -> dict:
    questions = connection.execute(
        """
        SELECT id, question_text
        FROM verification_questions
        WHERE found_item_id = ?
        ORDER BY id
        """,
        (row["id"],),
    ).fetchall()

    claim_count_row = connection.execute(
        "SELECT COUNT(*) AS claim_count FROM claims WHERE found_item_id = ?",
        (row["id"],),
    ).fetchone()

    return {
        "id": row["id"],
        "item_name": row["item_name"],
        "category": row["category"],
        "description": row["description"],
        "location": row["location"],
        "finder_name": row["finder_name"],
        "status": row["status"],
        "created_at": row["created_at"],
        "questions": [{"id": q["id"], "question_text": q["question_text"]} for q in questions],
        "claim_count": claim_count_row["claim_count"],
    }


def serialize_found_item_private(connection: sqlite3.Connection, row: sqlite3.Row) -> dict:
    item = serialize_found_item_public(connection, row)
    item["finder_contact"] = row["finder_contact"]
    item["verification_bank"] = [
        {
            "id": question["id"],
            "question_text": question["question_text"],
            "answer_text": question["answer_text"],
        }
        for question in connection.execute(
            """
            SELECT id, question_text, answer_text
            FROM verification_questions
            WHERE found_item_id = ?
            ORDER BY id
            """,
            (row["id"],),
        ).fetchall()
    ]

    claims = []
    claim_rows = connection.execute(
        """
        SELECT id, claimant_name, claimant_contact, claimant_message, status, created_at
        FROM claims
        WHERE found_item_id = ?
        ORDER BY created_at DESC
        """,
        (row["id"],),
    ).fetchall()

    for claim in claim_rows:
        answers = connection.execute(
            """
            SELECT verification_questions.question_text, claim_answers.answer_text
            FROM claim_answers
            JOIN verification_questions ON verification_questions.id = claim_answers.question_id
            WHERE claim_answers.claim_id = ?
            ORDER BY claim_answers.id
            """,
            (claim["id"],),
        ).fetchall()
        claims.append(
            {
                "id": claim["id"],
                "claimant_name": claim["claimant_name"],
                "claimant_contact": claim["claimant_contact"],
                "claimant_message": claim["claimant_message"],
                "status": claim["status"],
                "created_at": claim["created_at"],
                "answers": [
                    {
                        "question_text": answer["question_text"],
                        "answer_text": answer["answer_text"],
                    }
                    for answer in answers
                ],
            }
        )

    item["claims"] = claims
    return item


def parse_json() -> dict:
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


@app.route("/")
def serve_index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.get("/api/dashboard")
def get_dashboard():
    with closing(get_connection()) as connection:
        lost_items = [
            serialize_lost_item(row)
            for row in connection.execute(
                "SELECT * FROM lost_items ORDER BY created_at DESC"
            ).fetchall()
        ]
        found_items = [
            serialize_found_item_public(connection, row)
            for row in connection.execute(
                "SELECT * FROM found_items ORDER BY created_at DESC"
            ).fetchall()
        ]
        notifications = [
            dict(row)
            for row in connection.execute(
                "SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20"
            ).fetchall()
        ]

    return jsonify(
        {
            "lost_items": lost_items,
            "found_items": found_items,
            "notifications": notifications,
            "counts": {
                "lost": len(lost_items),
                "found": len(found_items),
                "notifications": len(notifications),
            },
        }
    )


@app.post("/api/lost-items")
def create_lost_item():
    data = parse_json()
    required_fields = [
        "item_name",
        "category",
        "description",
        "location",
        "owner_name",
        "contact_info",
    ]
    if any(not str(data.get(field, "")).strip() for field in required_fields):
        return jsonify({"error": "Please complete every lost item field."}), 400

    with closing(get_connection()) as connection:
        cursor = connection.execute(
            """
            INSERT INTO lost_items (
                item_name, category, description, location, owner_name, contact_info, status, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, 'Open', ?)
            """,
            (
                data["item_name"].strip(),
                data["category"].strip(),
                data["description"].strip(),
                data["location"].strip(),
                data["owner_name"].strip(),
                data["contact_info"].strip(),
                utc_now(),
            ),
        )
        add_notification(
            connection,
            "New lost report",
            f"{data['owner_name'].strip()} reported {data['item_name'].strip()} as lost.",
            "lost",
        )
        connection.commit()
        item_id = cursor.lastrowid

        row = connection.execute("SELECT * FROM lost_items WHERE id = ?", (item_id,)).fetchone()
        return jsonify({"item": serialize_lost_item(row)})


@app.post("/api/found-items")
def create_found_item():
    data = parse_json()
    required_fields = [
        "item_name",
        "category",
        "description",
        "location",
        "finder_name",
        "finder_contact",
    ]
    if any(not str(data.get(field, "")).strip() for field in required_fields):
        return jsonify({"error": "Please complete every found item field."}), 400

    questions = data.get("questions")
    if not isinstance(questions, list) or len(questions) < 3:
        return jsonify({"error": "Please add at least 3 verification questions."}), 400

    clean_questions = []
    for entry in questions:
        if not isinstance(entry, dict):
            continue
        question_text = str(entry.get("question_text", "")).strip()
        answer_text = str(entry.get("answer_text", "")).strip()
        if question_text and answer_text:
            clean_questions.append(
                {"question_text": question_text, "answer_text": answer_text}
            )

    if len(clean_questions) < 3:
        return jsonify({"error": "Each verification question needs a matching answer."}), 400

    access_key = secrets.token_urlsafe(9)

    with closing(get_connection()) as connection:
        cursor = connection.execute(
            """
            INSERT INTO found_items (
                item_name, category, description, location, finder_name, finder_contact, status, created_at, access_key
            )
            VALUES (?, ?, ?, ?, ?, ?, 'Awaiting Verification', ?, ?)
            """,
            (
                data["item_name"].strip(),
                data["category"].strip(),
                data["description"].strip(),
                data["location"].strip(),
                data["finder_name"].strip(),
                data["finder_contact"].strip(),
                utc_now(),
                access_key,
            ),
        )
        found_item_id = cursor.lastrowid

        for question in clean_questions:
            connection.execute(
                """
                INSERT INTO verification_questions (found_item_id, question_text, answer_text)
                VALUES (?, ?, ?)
                """,
                (found_item_id, question["question_text"], question["answer_text"]),
            )

        add_notification(
            connection,
            "New found report",
            f"{data['finder_name'].strip()} reported {data['item_name'].strip()} as found.",
            "found",
        )
        connection.commit()

        row = connection.execute("SELECT * FROM found_items WHERE id = ?", (found_item_id,)).fetchone()
        return jsonify(
            {
                "item": serialize_found_item_public(connection, row),
                "finder_access_key": access_key,
            }
        )


@app.post("/api/found-items/<int:found_item_id>/claims")
def submit_claim(found_item_id: int):
    data = parse_json()
    required_fields = ["claimant_name", "claimant_contact", "claimant_message"]
    if any(not str(data.get(field, "")).strip() for field in required_fields):
        return jsonify({"error": "Please complete the claim form before submitting."}), 400

    answers = data.get("answers")
    if not isinstance(answers, list) or not answers:
        return jsonify({"error": "Please answer the verification questions."}), 400

    with closing(get_connection()) as connection:
        item = connection.execute(
            "SELECT * FROM found_items WHERE id = ?",
            (found_item_id,),
        ).fetchone()
        if item is None:
            return jsonify({"error": "This found item no longer exists."}), 404

        valid_question_ids = {
            row["id"]
            for row in connection.execute(
                "SELECT id FROM verification_questions WHERE found_item_id = ?",
                (found_item_id,),
            ).fetchall()
        }

        cleaned_answers = []
        for answer in answers:
            if not isinstance(answer, dict):
                continue
            question_id = answer.get("question_id")
            answer_text = str(answer.get("answer_text", "")).strip()
            if question_id in valid_question_ids and answer_text:
                cleaned_answers.append((question_id, answer_text))

        if len(cleaned_answers) != len(valid_question_ids):
            return jsonify({"error": "Please answer every verification question."}), 400

        cursor = connection.execute(
            """
            INSERT INTO claims (
                found_item_id, claimant_name, claimant_contact, claimant_message, status, created_at
            )
            VALUES (?, ?, ?, ?, 'Pending Review', ?)
            """,
            (
                found_item_id,
                data["claimant_name"].strip(),
                data["claimant_contact"].strip(),
                data["claimant_message"].strip(),
                utc_now(),
            ),
        )
        claim_id = cursor.lastrowid

        for question_id, answer_text in cleaned_answers:
            connection.execute(
                """
                INSERT INTO claim_answers (claim_id, question_id, answer_text)
                VALUES (?, ?, ?)
                """,
                (claim_id, question_id, answer_text),
            )

        add_notification(
            connection,
            "Verification claim received",
            f"{data['claimant_name'].strip()} submitted a verification claim for {item['item_name']}.",
            "claim",
        )
        connection.commit()

        return jsonify({"message": "Claim submitted successfully. The finder can now review it."}), 201


@app.post("/api/found-items/<int:found_item_id>/finder-access")
def get_finder_vault(found_item_id: int):
    data = parse_json()
    access_key = str(data.get("access_key", "")).strip()
    if not access_key:
        return jsonify({"error": "Finder access key is required."}), 400

    with closing(get_connection()) as connection:
        row = connection.execute(
            "SELECT * FROM found_items WHERE id = ? AND access_key = ?",
            (found_item_id, access_key),
        ).fetchone()
        if row is None:
            return jsonify({"error": "Access key is invalid for this item."}), 403

        return jsonify({"item": serialize_found_item_private(connection, row)})


@app.post("/api/found-items/<int:found_item_id>/status")
def update_found_status(found_item_id: int):
    data = parse_json()
    access_key = str(data.get("access_key", "")).strip()
    new_status = str(data.get("status", "")).strip()
    allowed_statuses = {"Awaiting Verification", "Matched With Owner", "Returned"}

    if new_status not in allowed_statuses:
        return jsonify({"error": "Invalid status selected."}), 400

    with closing(get_connection()) as connection:
        row = connection.execute(
            "SELECT * FROM found_items WHERE id = ? AND access_key = ?",
            (found_item_id, access_key),
        ).fetchone()
        if row is None:
            return jsonify({"error": "Access key is invalid for this item."}), 403

        connection.execute(
            "UPDATE found_items SET status = ? WHERE id = ?",
            (new_status, found_item_id),
        )
        add_notification(
            connection,
            "Found item updated",
            f"{row['item_name']} is now marked as {new_status}.",
            "update",
        )
        connection.commit()

        updated_row = connection.execute(
            "SELECT * FROM found_items WHERE id = ?",
            (found_item_id,),
        ).fetchone()
        return jsonify({"item": serialize_found_item_private(connection, updated_row)})


@app.get("/api/notifications")
def list_notifications():
    with closing(get_connection()) as connection:
        notifications = [
            dict(row)
            for row in connection.execute(
                "SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20"
            ).fetchall()
        ]
    return jsonify({"notifications": notifications})


@app.get("/api/export/requirements")
def export_requirements():
    requirements = {
        "languages": ["HTML", "CSS", "Python"],
        "database": "MySQL-ready design with SQLite demo persistence",
        "tools": ["Visual Studio Code", "Browser"],
        "hardware": {
            "ram": "2 GB RAM",
            "storage": "100 GB Hard disk",
            "os": ["Windows 10", "Windows 11"],
            "processor": "Intel i3 or equivalent",
        },
    }
    return app.response_class(
        response=json.dumps(requirements, indent=2),
        mimetype="application/json",
    )


init_db()


if __name__ == "__main__":
    app.run(debug=True)
