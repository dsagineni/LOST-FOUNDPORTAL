CREATE TABLE IF NOT EXISTS lost_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    contact_info VARCHAR(255) NOT NULL,
    status VARCHAR(100) NOT NULL DEFAULT 'Open',
    created_at VARCHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS found_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(255) NOT NULL,
    finder_name VARCHAR(255) NOT NULL,
    finder_contact VARCHAR(255) NOT NULL,
    status VARCHAR(100) NOT NULL DEFAULT 'Awaiting Verification',
    created_at VARCHAR(64) NOT NULL,
    access_key VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    found_item_id INT NOT NULL,
    question_text TEXT NOT NULL,
    answer_text TEXT NOT NULL,
    CONSTRAINT fk_verification_found
        FOREIGN KEY (found_item_id) REFERENCES found_items(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS claims (
    id INT AUTO_INCREMENT PRIMARY KEY,
    found_item_id INT NOT NULL,
    claimant_name VARCHAR(255) NOT NULL,
    claimant_contact VARCHAR(255) NOT NULL,
    claimant_message TEXT NOT NULL,
    status VARCHAR(100) NOT NULL DEFAULT 'Pending Review',
    created_at VARCHAR(64) NOT NULL,
    CONSTRAINT fk_claim_found
        FOREIGN KEY (found_item_id) REFERENCES found_items(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS claim_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    claim_id INT NOT NULL,
    question_id INT NOT NULL,
    answer_text TEXT NOT NULL,
    CONSTRAINT fk_answer_claim
        FOREIGN KEY (claim_id) REFERENCES claims(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_answer_question
        FOREIGN KEY (question_id) REFERENCES verification_questions(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(100) NOT NULL,
    created_at VARCHAR(64) NOT NULL
);
