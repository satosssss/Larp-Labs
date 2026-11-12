# Requirements Document

## Introduction

LegaLinaw (Legal Notice Helper) is a web application that helps Filipino adults understand confusing legal notices such as subpoenas, demand letters, barangay blotter records, and threats from online lending apps. The user uploads a photo or PDF, Lumen OCR extracts the text, the user reviews and corrects the text, and Lumen AI Chat explains the notice in plain Filipino or English. LegaLinaw does not give legal advice. It replaces panic with understanding and directs users to free legal help before deadlines pass.

The product follows three principles:

1. Source-backed AI explanations: every important claim is traceable to the uploaded document.
2. Filipino-first accessibility: concepts are explained in language ordinary Filipinos understand, beyond literal translation.
3. Responsible legal assistance: the product never presents itself as a lawyer and helps users recognize when they need one and where to find accessible help.

The primary users are Filipino adults who received a confusing notice. The product supports SDG 16 (main) and SDG 10. The technology stack is Next.js, TypeScript, Supabase (database and file storage), Lumen as the primary AI provider (OCR and chat), and Vercel deployment.

First-version scope decisions: no login, no saved document history, and a downloadable summary. The product explains session loss and what data is sent to Lumen.

### Assumptions (to be confirmed by the user)

- A1. "Share with Family" creates a read-only page containing only the redacted simple summary, stored in Supabase and deleted 24 hours after creation.
- A2. Uploaded files and extracted text stored in Supabase are deleted when the session ends, and no later than 24 hours after upload.
- A3. Free Legal Help Finder data is a curated dataset maintained by the project team in Supabase, with a last-verified date per entry. It is not fetched live from third-party sources.
- A4. Location is determined by the user selecting a province and city or municipality; browser geolocation is an optional shortcut.
- A5. Text-to-Speech uses the browser Web Speech API with available Filipino and English voices.
- A6. Redaction is performed in the browser before text is sent to Lumen, and the original unredacted text is never sent.

## Glossary

- **LegaLinaw**: The web application described in this document.
- **Notice**: A document uploaded by the user, such as a subpoena, legal notice, demand letter, barangay blotter record, or lending app threat message.
- **Session**: One continuous visit by a user, without login, that ends when the user closes the browser tab, selects "Delete my data", or the inactivity timeout elapses.
- **Upload_Service**: The LegaLinaw component that receives, validates, and stores uploaded files.
- **Quality_Checker**: The LegaLinaw component that assesses photo quality before OCR.
- **Lumen**: The primary external AI provider used by LegaLinaw for OCR and chat.
- **OCR_Service**: The LegaLinaw component that sends images or PDFs to Lumen OCR and receives extracted text.
- **Review_Screen**: The screen where the user checks and edits extracted text before AI evaluation.
- **Redactor**: The LegaLinaw component that masks personal data in text before the text is sent to Lumen AI.
- **Classifier**: The LegaLinaw component that determines the Notice type.
- **Explainer**: The LegaLinaw component that produces the plain-language explanation of a Notice using Lumen AI.
- **Chat_Assistant**: The Lumen AI Chat interface within LegaLinaw for follow-up questions.
- **Guardrail**: A rule that prevents the Explainer and Chat_Assistant from giving legal advice or predicting case outcomes.
- **Source_Checker**: The LegaLinaw component that links each AI statement to a supporting sentence in the Notice text.
- **Scam_Detector**: The LegaLinaw component that evaluates a Notice for signs of fakery or fraud.
- **Sender_Verification_Guide**: The LegaLinaw guide that explains how to verify a sender through official channels.
- **Lending_Harassment_Mode**: The LegaLinaw mode that analyzes Notices and messages from online lending apps for harassment.
- **Deadline_Tracker**: The LegaLinaw component that extracts deadline dates and shows urgency and countdown.
- **Checklist_Generator**: The LegaLinaw component that produces the Action Checklist.
- **Help_Finder**: The LegaLinaw component that lists nearby free legal help providers.
- **Provider**: A free or accessible legal help source: Public Attorney's Office (PAO), Integrated Bar of the Philippines (IBP) Legal Aid, a law school legal aid clinic, or a barangay Lupon Tagapamayapa.
- **Question_Generator**: The LegaLinaw component that produces "Questions to Ask Your Lawyer".
- **Report_Generator**: The LegaLinaw component that produces the one-page Legal Preparation Report in PDF format.
- **Share_Service**: The LegaLinaw component that creates the "Share with Family" link.
- **Serializer**: The LegaLinaw component that converts structured Notice data into JSON.
- **Parser**: The LegaLinaw component that converts JSON into structured Notice data.
- **TTS_Player**: The LegaLinaw component that reads text aloud.
- **Confidence_Score**: A percentage from 0 to 100 indicating the estimated reliability of an extracted value or AI output.
- **Key_Field**: A date, person or organization name, or monetary amount extracted from a Notice.
- **SEC**: Securities and Exchange Commission of the Philippines.
- **NPC**: National Privacy Commission of the Philippines.
- **PAO**: Public Attorney's Office of the Philippines.
- **Supabase_Store**: The Supabase database and file storage used by LegaLinaw.

## Requirements

### Requirement 1: Upload a Notice

**User Story:** As a Filipino adult who received a notice, I want to upload a photo or PDF of it, so that LegaLinaw can read it for me.

#### Acceptance Criteria

1. WHEN the user selects a file, THE Upload_Service SHALL accept the file if its format is JPEG, PNG, HEIC, or PDF, determined from the file contents and not only the file extension.
2. WHEN the user selects a file of 10 MB (10,485,760 bytes) or less and greater than 0 bytes, THE Upload_Service SHALL accept the file.
3. WHEN the user selects a file, THE Upload_Service SHALL display a preview of the file within 2 seconds for files up to 10 MB, showing the image for JPEG, PNG, and HEIC files and the first page for PDF files.
4. IF the user selects a file with an unsupported format, THEN THE Upload_Service SHALL reject the file, display a message in the selected language listing the supported formats (JPEG, PNG, HEIC, PDF), and keep any previously accepted file unchanged.
5. IF the user selects a file larger than 10 MB, THEN THE Upload_Service SHALL reject the file, display a message in the selected language stating the 10 MB limit, and keep any previously accepted file unchanged.
6. WHERE the user's device has a camera, THE Upload_Service SHALL offer a capture-photo option in addition to file selection.
7. IF the user selects a PDF with more than 10 pages, THEN THE Upload_Service SHALL reject the file and display a message in the selected language stating the 10-page limit.
8. IF the user selects a file that is empty, corrupted, or password-protected so that it cannot be previewed, THEN THE Upload_Service SHALL reject the file and display a message in the selected language stating that the file cannot be read and asking the user to select a different file.
9. WHEN the user selects a new file while an accepted file is already shown, THE Upload_Service SHALL replace the earlier file with the new file only after the new file is accepted.

### Requirement 2: Low-Quality Photo Helper

**User Story:** As a user taking a photo with a basic phone, I want to be told when the photo is unreadable, so that I can retake it before wasting time.

#### Acceptance Criteria

1. WHEN the user uploads a JPEG, PNG, or HEIC image, THE Quality_Checker SHALL assess the image for blur, low brightness, and cropped edges within 5 seconds and before OCR starts.
2. WHEN the user uploads a PDF, THE Quality_Checker SHALL skip the photo quality assessment and proceed to OCR without requiring additional user action.
3. IF the Quality_Checker detects low brightness, THEN THE Quality_Checker SHALL display the tip "Masyadong madilim, subukan ulit malapit sa bintana." when Filipino is selected, or an English equivalent when English is selected.
4. IF the Quality_Checker detects blur, THEN THE Quality_Checker SHALL display a tip, in the selected language, to hold the phone steady and tap the screen to focus.
5. IF the Quality_Checker detects a cropped document edge, THEN THE Quality_Checker SHALL display a tip, in the selected language, to include all four corners of the page in the photo.
6. IF the Quality_Checker detects more than one quality problem, THEN THE Quality_Checker SHALL display the tip for each detected problem on the same screen.
7. WHEN the Quality_Checker flags a quality problem, THE Quality_Checker SHALL offer both "Subukan ulit" (retake) and "Ituloy pa rin" (continue anyway) actions and SHALL NOT start OCR until the user selects one.
8. WHEN the user selects "Subukan ulit", THE Quality_Checker SHALL discard the flagged image from the Session and return the user to the upload stage.
9. WHEN the user selects "Ituloy pa rin", THE Quality_Checker SHALL proceed to OCR with the flagged image unchanged.
10. WHEN the Quality_Checker finds no quality problem, THE Quality_Checker SHALL proceed to OCR without requiring additional user action.
11. IF the Quality_Checker fails to complete the assessment within 5 seconds or returns an error, THEN THE Quality_Checker SHALL skip the assessment, display a message in the selected language that the photo quality could not be checked, and offer "Subukan ulit" and "Ituloy pa rin" actions with the uploaded image preserved in the Session.

### Requirement 3: OCR Text Extraction

**User Story:** As a user, I want the text of my notice extracted automatically, so that I do not have to retype it.

#### Acceptance Criteria

1. WHEN the user confirms an upload, THE OCR_Service SHALL send the file to Lumen OCR and, on success, return the extracted text to the Review_Screen.
2. WHILE OCR is in progress, THE OCR_Service SHALL display a progress indicator with a message in the selected language, starting within 1 second of the user's confirmation.
3. THE OCR_Service SHALL extract text written in English, Filipino, or a mix of both languages within the same Notice.
4. WHEN OCR completes, THE OCR_Service SHALL assign a Confidence_Score, as an integer from 0 to 100, to each Key_Field extracted.
5. IF Lumen OCR returns an error, THEN THE OCR_Service SHALL stop the progress indicator, display a message in the selected language stating that the text could not be read, offer "retry" and "upload a different file" actions, and retain the uploaded file in the Session.
6. IF Lumen OCR returns no text or text containing no alphanumeric characters, THEN THE OCR_Service SHALL stop the progress indicator, display a message in the selected language stating that no text was found, and offer "retry" and "upload a different file" actions.
7. IF Lumen OCR does not respond within 60 seconds of the request being sent, THEN THE OCR_Service SHALL cancel the request, stop the progress indicator, display a message in the selected language stating that the request timed out, and offer a retry action that resends the retained uploaded file without requiring re-upload.
8. IF the user selects retry 3 consecutive times and OCR fails each time, THEN THE OCR_Service SHALL display a message recommending that the user upload a clearer file or a different file.

### Requirement 4: OCR Text Review and Editing

**User Story:** As a user, I want to check and correct the extracted text, so that the explanation is based on what my notice actually says.

#### Acceptance Criteria

1. WHEN OCR completes, THE Review_Screen SHALL display the extracted text in an editable field alongside the uploaded image, with the image and the text field both visible on a viewport of 360 px width or greater.
2. THE Review_Screen SHALL display the Confidence_Score as a whole-number percentage from 0 to 100 beside each date, name, and amount extracted from the Notice.
3. IF a Key_Field has a Confidence_Score below 80, THEN THE Review_Screen SHALL highlight the Key_Field and prompt the user to verify it.
4. WHEN the user edits a Key_Field that has a Confidence_Score below 80, THE Review_Screen SHALL remove the highlight and the verification prompt from that Key_Field.
5. WHEN the user edits the extracted text, THE Review_Screen SHALL retain the edits for use in all later steps of the Session, including after the user navigates back to a previous stage.
6. WHILE the extracted text field is empty or contains only whitespace, THE Review_Screen SHALL disable the "Tama ang text" confirmation and display a message indicating that text is required.
7. WHEN the user selects the "Tama ang text" (text is correct) confirmation, THE Review_Screen SHALL start the Explainer. THE Explainer SHALL NOT start before this confirmation is selected.
8. WHEN the Redactor produces redacted text, THE Review_Screen SHALL display the redacted version of the text that will be sent to Lumen AI, and SHALL update the displayed version within 1 second of each edit to the extracted text, before the user selects the "Tama ang text" confirmation.
9. IF the extracted text exceeds 20,000 characters, THEN THE Review_Screen SHALL display a message stating the 20,000-character limit and disable the "Tama ang text" confirmation until the text is at or below the limit.

### Requirement 5: Privacy-First Mode and Redaction

**User Story:** As a privacy-conscious user, I want my personal details hidden before AI reads my notice, so that my identity is protected.

#### Acceptance Criteria

1. THE LegaLinaw SHALL enable Privacy-First Mode by default at the start of each Session.
2. WHERE Privacy-First Mode is enabled, WHEN the user confirms the reviewed text, THE Redactor SHALL replace each personal name, home address, and government ID number in the text with a placeholder before the text is sent to Lumen AI.
3. THE Redactor SHALL perform redaction in the user's browser so that unredacted text is never sent to Lumen AI.
4. IF the Redactor fails to complete redaction, THEN THE LegaLinaw SHALL not send any text to Lumen AI, SHALL display a message indicating that redaction failed and offering retry, and SHALL retain the reviewed text in the Session.
5. WHEN the Redactor masks a value, THE Review_Screen SHALL allow the user to unmask or mask any individual value before the user confirms, and SHALL update the displayed redacted text within 1 second of each change.
6. WHEN Lumen AI returns text containing placeholders, THE LegaLinaw SHALL replace each placeholder with its original value on the user's screen only, and SHALL not send the original values to Lumen AI or store them in the Supabase_Store.
7. THE LegaLinaw SHALL display a plain-language notice before the first upload stating what data is sent to Lumen, what is stored in the Supabase_Store, and that uploaded files and extracted text are kept until the Session ends and no longer than 24 hours.
8. THE LegaLinaw SHALL display a plain-language notice before the first upload stating that closing the Session loses the results unless the user downloads the summary.
9. WHEN the user selects "Delete my data", THE LegaLinaw SHALL delete all files and extracted text for the Session from the Supabase_Store within 60 seconds and display a confirmation.
10. IF deletion from the Supabase_Store fails after the user selects "Delete my data", THEN THE LegaLinaw SHALL display a message indicating that deletion did not complete, offer retry, and retry deletion automatically up to 3 times at 10-second intervals.
11. WHEN a Session ends, THE LegaLinaw SHALL delete all files and extracted text for the Session from the Supabase_Store within 60 seconds.
12. WHEN 24 hours have elapsed since an upload, THE LegaLinaw SHALL delete the stored file and extracted text for that upload from the Supabase_Store within 60 seconds.

### Requirement 6: Notice Type Classification

**User Story:** As a user, I want to know what kind of document I received, so that I understand how serious it is.

#### Acceptance Criteria

1. WHEN the user confirms the reviewed text, THE Classifier SHALL assign exactly one Notice type from: subpoena, court summons, demand letter, barangay summons or blotter, lending app collection message, government agency notice, or unrecognized, and SHALL complete the assignment within 15 seconds under normal network conditions.
2. WHEN the Classifier assigns a type, THE Explainer SHALL display a "What is this?" card with the type name and a plain-language description of what this type of document is, in the selected language and of no more than 100 words.
3. WHEN the Explainer displays the "What is this?" card for a type other than "unrecognized", THE Explainer SHALL state on the card the agency or office that normally issues this type of document.
4. IF the Classifier cannot assign a type with a Confidence_Score of at least 60, THEN THE Classifier SHALL assign the type "unrecognized" and display a message in the selected language telling the user that the document type could not be determined.
5. WHERE the user disagrees with the assigned type, THE Classifier SHALL allow the user to select a different type from the seven listed in criterion 1 and regenerate the explanation, and SHALL retain the user-selected type for the rest of the Session.
6. IF the Classifier or the regeneration request fails because Lumen returns an error or does not respond within 30 seconds, THEN THE Classifier SHALL display a message indicating that classification failed, offer retry and manual type selection actions, and preserve the reviewed text in the Session.
7. WHEN the Classifier assigns the type "unrecognized", THE Explainer SHALL display a manual type selection prompt and a recommendation to consult a Provider, and SHALL leave the Explainer's remaining sections available using the reviewed text.

### Requirement 7: Plain-Language Explanation in Filipino and English

**User Story:** As a user with limited English or education, I want the notice explained in everyday language, so that I understand what it means for me.

#### Acceptance Criteria

1. WHEN the Notice type is assigned, THE Explainer SHALL generate an explanation containing four labeled sections: what the Notice is, who sent it, what it asks of the user, and the key dates and amounts stated in the Notice.
2. WHEN the user switches the language between Filipino and English, THE Explainer SHALL display the explanation in the newly selected language within 3 seconds and retain the user's scroll position and open term definitions.
3. THE Explainer SHALL offer the explanation in Filipino and in English.
4. THE Explainer SHALL define each legal term that appears in the Notice in no more than 2 sentences of everyday words, followed by one example set in a Philippine context.
5. THE Explainer SHALL write Filipino explanations in everyday spoken Filipino and SHALL NOT produce a word-for-word translation of the English text.
6. WHEN the user taps a highlighted legal term, THE Explainer SHALL display the plain-language definition of that term within 1 second.
7. THE Explainer SHALL include a "What happens if I ignore this?" section that lists each consequence together with a label of either "stated in the Notice" or "general information".
8. IF a consequence in the "What happens if I ignore this?" section is not stated in the Notice, THEN THE Explainer SHALL label it "general information" and SHALL NOT present it as a statement from the Notice.
9. THE Explainer SHALL complete the initial explanation within 30 seconds of the user's confirmation when the network round-trip time to Lumen is 300 ms or less.
10. IF the Explainer does not complete the initial explanation within 30 seconds, or Lumen returns an error, THEN THE Explainer SHALL display a message indicating that the explanation could not be completed, offer a retry action, and retain the reviewed text in the Session.

### Requirement 8: Source Checker

**User Story:** As a user, I want to see where in my notice each explanation comes from, so that I can trust it and catch mistakes.

#### Acceptance Criteria

1. WHEN the Explainer generates an explanation, THE Source_Checker SHALL attach one or more source references to each important claim, where an important claim is any statement about a date, amount, party, required action, or consequence.
2. WHEN the user clicks a source reference, THE Source_Checker SHALL highlight the supporting sentence in the reviewed Notice text, scroll it into view within 1 second, and keep the highlight until the user clicks another source reference or dismisses it.
3. IF the Source_Checker finds no supporting sentence in the reviewed Notice text for a claim, THEN THE Source_Checker SHALL display "Hindi ito nakasaad sa dokumento." beside the claim when the selected language is Filipino, or "This is not stated in the document." when the selected language is English, and SHALL not attach a source reference to that claim.
4. THE Source_Checker SHALL ensure that every highlighted sentence is an exact, character-for-character substring of the reviewed Notice text, including any edits the user made on the Review_Screen.
5. WHEN the Chat_Assistant answers a question about the Notice, THE Source_Checker SHALL attach source references to each important claim in the answer and apply the behavior in criteria 2 and 3.
6. IF the Source_Checker cannot validate a source reference as an exact substring of the reviewed Notice text, THEN THE Source_Checker SHALL treat the claim as having no supporting sentence and apply criterion 3.
7. IF the user edits the reviewed Notice text after an explanation is generated and a source reference's sentence no longer appears in the edited text, THEN THE Source_Checker SHALL mark that source reference as outdated and prompt the user to regenerate the explanation.

### Requirement 9: AI Confidence and Uncertainty Indicator

**User Story:** As a user, I want to know how sure the AI is, so that I know when to double-check or consult a lawyer.

#### Acceptance Criteria

1. WHEN the Explainer displays an explanation, THE Explainer SHALL display an overall Confidence_Score level of High (80 to 100), Medium (50 to 79), or Low (0 to 49), together with a one-sentence plain-language meaning of that level in the selected language.
2. IF the overall Confidence_Score is below 50, THEN THE Explainer SHALL display, at the top of the explanation, a message recommending that the user consult a lawyer or a Provider, with a link to the Help_Finder.
3. IF the Explainer's Confidence_Score for a specific statement is below 50, THEN THE Explainer SHALL mark that statement with an uncertainty indicator and a text label stating that the statement is uncertain.
4. IF the OCR Confidence_Score of any Key_Field used in a statement is below 80 and the user has not edited that Key_Field, THEN THE Explainer SHALL mark the statement with the uncertainty indicator and a text label stating that the source value may have been misread.
5. WHEN the user edits a Key_Field, THE Explainer SHALL remove the OCR-based uncertainty indicator from statements that use that Key_Field when the explanation is regenerated.
6. IF the Explainer cannot compute an overall Confidence_Score, THEN THE Explainer SHALL display the level as Low and apply the message required by criterion 2.

### Requirement 10: Deadline and Urgency Flag with Countdown

**User Story:** As a user, I want to know if my notice has a deadline and how much time is left, so that I do not miss it.

#### Acceptance Criteria

1. WHEN the user confirms the reviewed text, THE Deadline_Tracker SHALL display each date that the Notice identifies as a deadline, appearance date, or hearing date, up to 5 dates, together with the supporting sentence from the Notice.
2. WHEN a deadline date is found and confirmed, THE Deadline_Tracker SHALL display a countdown in whole days and whole hours remaining, calculated against the current time in Philippine Standard Time (UTC+8), and SHALL update the countdown at least once every 60 seconds while the countdown is visible.
3. IF the Notice states a deadline date without a time of day, THEN THE Deadline_Tracker SHALL treat the deadline as ending at 23:59 Philippine Standard Time on that date.
4. IF the Notice contains more than one deadline date, THEN THE Deadline_Tracker SHALL show the countdown for each date and SHALL mark the earliest upcoming date as the nearest deadline.
5. IF 3 days (72 hours) or fewer remain until a deadline and the deadline has not passed, THEN THE Deadline_Tracker SHALL display an urgent flag and a message recommending that the user contact a Provider immediately.
6. IF a deadline date has passed, THEN THE Deadline_Tracker SHALL display a message stating that the date has passed, SHALL not display a countdown for that date, and SHALL display a message recommending that the user contact a Provider immediately.
7. IF the Notice does not contain a date identified as a deadline, appearance date, or hearing date, THEN THE Deadline_Tracker SHALL not display a countdown and SHALL display the message "Walang petsang nakasaad sa dokumento." in Filipino or "No date is stated in the document." in English.
8. THE Deadline_Tracker SHALL not infer or estimate a deadline from information other than a date stated in the Notice, including a number of days to respond counted from a date of receipt.
9. IF a deadline date is ambiguous or has a Confidence_Score below 80, THEN THE Deadline_Tracker SHALL ask the user to confirm or correct the date before displaying the countdown, and SHALL keep the countdown hidden until the user responds. A date is ambiguous when it can be read as more than one calendar date, such as a day and month that can be swapped, or when it lacks a day, month, or year.
10. IF the user corrects a deadline date, THEN THE Deadline_Tracker SHALL use the corrected date for the countdown, the urgent flag, and the Action Checklist for the rest of the Session.

### Requirement 11: Scam and Fake Notice Detector

**User Story:** As a user, I want to know if my notice might be fake, so that I do not pay or respond to a scammer.

#### Acceptance Criteria

1. WHEN the user confirms the reviewed text, THE Scam_Detector SHALL evaluate the Notice for the scam indicators listed in criterion 2 and display a risk level of Low, Medium, or High within 30 seconds under normal network conditions.
2. THE Scam_Detector SHALL check for the following indicators: demand for immediate payment through e-wallet or bank transfer to a personal account, threat of arrest within 24 hours or less, request for an OTP or password, missing or mismatched issuing office name or address, and generic salutation without the recipient's name.
3. THE Scam_Detector SHALL assign the risk level as Low when 0 indicators are found, Medium when 1 indicator is found, and High when 2 or more indicators are found, or when a request for an OTP or password is found.
4. WHEN the Scam_Detector finds an indicator, THE Scam_Detector SHALL list the indicator name and the supporting sentence, which SHALL be an exact substring of the reviewed Notice text.
5. IF the Scam_Detector finds no indicators, THEN THE Scam_Detector SHALL display the Low risk level and a statement that no scam indicators were found in the provided text.
6. THE Scam_Detector SHALL state on the result display that the result is an indication and not proof of authenticity or fraud.
7. WHEN the Scam_Detector displays any risk level, THE Scam_Detector SHALL show a link to the Sender_Verification_Guide.
8. IF the risk level is High, THEN THE Scam_Detector SHALL display a message advising the user not to pay or share personal information until the sender is verified, placed above the indicator list.
9. IF the Scam_Detector fails to complete the evaluation or Lumen is unavailable, THEN THE Scam_Detector SHALL display a message that the scam check could not be completed, offer a retry action, show the link to the Sender_Verification_Guide, and retain the reviewed text in the Session.

### Requirement 12: Verify-the-Sender Guide

**User Story:** As a user, I want to know how to check if the sender is real, so that I can confirm the notice safely.

#### Acceptance Criteria

1. WHEN the user opens the Sender_Verification_Guide, THE Sender_Verification_Guide SHALL display an instruction to verify the sender through official channels that the user finds independently of the Notice, such as by searching the official website of the issuing office or visiting the office in person.
2. WHEN the user opens the Sender_Verification_Guide, THE Sender_Verification_Guide SHALL display an instruction not to use the phone numbers, email addresses, links, or payment accounts printed on the Notice.
3. WHEN the Notice type is assigned, THE Sender_Verification_Guide SHALL list between 1 and 5 official verification channels for that type, each showing the channel name and a short description of what to ask or confirm. The channels are the court clerk's office for a subpoena or court summons, the barangay hall for a barangay summons or blotter, the SEC for a lending app collection message, and the issuing agency's official website for a government agency notice or demand letter.
4. IF the Notice type is "unrecognized", THEN THE Sender_Verification_Guide SHALL display the general verification instructions from criteria 1 and 2 and list the Provider types from the Help_Finder as contacts that can help identify the sender.
5. THE Sender_Verification_Guide SHALL be available in Filipino and English, and WHEN the user switches the language, THE Sender_Verification_Guide SHALL display all guide content in the selected language within 1 second without losing the user's place in the guide.
6. IF Lumen is unavailable, THEN THE Sender_Verification_Guide SHALL remain displayed with the content for the assigned Notice type, or with the general instructions from criteria 1 and 2 if no type has been assigned.

### Requirement 13: Lending App Harassment Mode

**User Story:** As a borrower harassed by a lending app, I want to understand my rights and where to report, so that I can stop the harassment.

#### Acceptance Criteria

1. WHEN the Notice type is "lending app collection message", THE LegaLinaw SHALL activate the Lending_Harassment_Mode within 2 seconds of the type being assigned.
2. WHEN the Lending_Harassment_Mode is active, THE Lending_Harassment_Mode SHALL analyze the reviewed text for contact-shaming, threats of arrest or violence, and messages sent to contacts who are not the borrower, and SHALL display each detection with its category and the supporting sentence, which is an exact substring of the reviewed text.
3. WHEN the Lending_Harassment_Mode detects harassment, THE Lending_Harassment_Mode SHALL explain in plain language, in the language selected by the user, the SEC rules on unfair debt collection and the Data Privacy Act of 2012 that relate to each detected category.
4. WHEN the Lending_Harassment_Mode detects harassment, THE Lending_Harassment_Mode SHALL list SEC and NPC as reporting offices, each with at least one official contact channel (website, email address, or phone number) and the date the contact channel was last verified.
5. WHEN the Lending_Harassment_Mode is active, THE Lending_Harassment_Mode SHALL display an evidence-saving guide covering screenshots with visible date and time, saving the sender's number or account, and keeping complete message threads, in the language selected by the user.
6. WHEN the user selects "Download evidence summary", THE Lending_Harassment_Mode SHALL generate within 10 seconds a downloadable file listing each detected harassment statement, the dates found in the Notice, the sender name found in the Notice, and the date the summary was generated.
7. IF the Notice contains no date or no sender name, THEN THE Lending_Harassment_Mode SHALL show "Hindi nakasaad sa dokumento" in Filipino or "Not stated in the document" in English in the evidence summary for the missing item, and SHALL NOT infer a value.
8. IF the Lending_Harassment_Mode detects no harassment, THEN THE Lending_Harassment_Mode SHALL state that no harassment indicators were found in the provided text, remind the user that the check covers only the provided text, and still display the evidence-saving guide.
9. IF Lumen AI is unavailable or does not respond within 30 seconds during harassment analysis, THEN THE Lending_Harassment_Mode SHALL display a message that the analysis could not be completed, offer a retry action, and still display the evidence-saving guide and the SEC and NPC contact channels.
10. THE Lending_Harassment_Mode SHALL display the "Hindi ito legal advice" disclaimer on the harassment analysis screen and in the evidence summary.

### Requirement 14: Lumen Chat for Follow-Up Questions

**User Story:** As a user, I want to ask follow-up questions about my notice, so that I can understand parts that are still unclear.

#### Acceptance Criteria

1. WHEN the explanation is displayed, THE Chat_Assistant SHALL enable a text input for follow-up questions about the Notice.
2. THE Chat_Assistant SHALL accept a question of 1 to 500 characters per message.
3. IF the user submits an empty question or a question longer than 500 characters, THEN THE Chat_Assistant SHALL reject the message, display a message stating the 1 to 500 character limit, and keep the entered text in the input.
4. WHEN the user submits a question, THE Chat_Assistant SHALL answer in the language currently selected by the user, in Filipino or English.
5. WHEN the explanation is first displayed, THE Chat_Assistant SHALL display 3 to 5 suggested follow-up questions based on the Notice type and content.
6. WHEN the user selects a suggested question, THE Chat_Assistant SHALL submit it as if the user had typed it.
7. WHEN the user asks about a term in the Notice, THE Chat_Assistant SHALL explain the term in everyday words in the selected language.
8. WHEN the Chat_Assistant answers a question about the Notice, THE Chat_Assistant SHALL base the answer on the reviewed text and SHALL attach source references through the Source_Checker to each date, amount, party, required action, and consequence in the answer.
9. IF a question cannot be answered from the reviewed text, THEN THE Chat_Assistant SHALL state "Hindi ito nakasaad sa dokumento." in Filipino or "This is not stated in the document." in English, and provide only general information labeled as general information.
10. WHILE the Chat_Assistant is generating a response, THE Chat_Assistant SHALL display a typing indicator and disable submission of a new question.
11. IF Lumen AI Chat does not respond within 30 seconds, THEN THE Chat_Assistant SHALL cancel the request, display a message that the answer could not be retrieved, offer a retry action, and keep the user's question and the earlier conversation visible.
12. IF Lumen AI Chat returns an error, THEN THE Chat_Assistant SHALL display the same message and retry action as for a timeout, without displaying technical error details.

### Requirement 15: Not Legal Advice Guardrails

**User Story:** As a responsible provider, I want the product to avoid giving legal advice, so that users are not misled into harmful decisions.

#### Acceptance Criteria

1. THE Guardrail SHALL prevent the Explainer and the Chat_Assistant from predicting case outcomes, including statements that the user will win, lose, be acquitted, be convicted, be jailed, or be cleared, in both Filipino and English (for example "you will win", "you will lose", "mananalo ka", "matatalo ka").
2. THE Guardrail SHALL prevent the Explainer and the Chat_Assistant from instructing the user to plead guilty, plead not guilty, sign, settle, pay, ignore the Notice, or skip an appearance, in both Filipino and English.
3. WHEN the user asks the Chat_Assistant for legal advice or an outcome prediction, THE Chat_Assistant SHALL decline, state that LegaLinaw is not a lawyer, and display a link to the Help_Finder.
4. WHEN the Chat_Assistant declines a request, THE Chat_Assistant SHALL provide, in the same response, general information drawn from the reviewed Notice text and the Provider list, labeled as general information.
5. THE LegaLinaw SHALL display the "Hindi ito legal advice" disclaimer, with an English equivalent when English is selected, on the explanation screen, the chat screen, the Legal Preparation Report, and the shared summary.
6. IF the Notice type is a subpoena, court summons, or any document requiring an appearance, THEN THE Explainer SHALL display a recommendation to consult a lawyer or Provider, placed in the explanation screen above the Action Checklist, and SHALL display a link to the Help_Finder with that recommendation.
7. WHEN the Explainer or the Chat_Assistant generates a response, THE Guardrail SHALL evaluate the response against criteria 1 and 2 before the response is displayed to the user.
8. IF the Guardrail determines that a response violates criterion 1 or 2, THEN THE Guardrail SHALL withhold that response, display a message stating that the response could not be shown because LegaLinaw does not give legal advice, display a link to the Help_Finder, and keep the user's reviewed text and prior conversation in the Session.
9. IF the Guardrail evaluation fails or does not complete within 10 seconds, THEN THE Guardrail SHALL withhold the response, display a message offering retry, and keep the user's reviewed text and prior conversation in the Session.

### Requirement 16: Action Checklist

**User Story:** As a user, I want a clear list of what to do next, so that I know my next steps without being told what legal decision to make.

#### Acceptance Criteria

1. WHEN the explanation is displayed, THE Checklist_Generator SHALL produce an Action Checklist within 10 seconds, with three groups labeled "what to verify", "what to prepare", and "whom to contact", and with at least 1 and at most 10 items in each group.
2. THE Checklist_Generator SHALL include in the "what to prepare" group an item for the original Notice, an item for valid identification, and one item for each related document mentioned in the Notice, up to a maximum of 5 related-document items.
3. THE Checklist_Generator SHALL include in the Action Checklist a cost hint stating that fixers or unofficial persons who ask for upfront fees should be avoided and that PAO services are free for qualified persons.
4. WHEN the user marks or unmarks a checklist item, THE Checklist_Generator SHALL update the item's done state on screen within 1 second and retain the state for the rest of the Session.
5. WHEN a deadline date is found, THE Checklist_Generator SHALL place a contact-a-Provider item as the first item of the Action Checklist, above all items in all groups.
6. IF the Checklist_Generator produces an item that instructs the user to plead guilty, plead not guilty, sign, settle, or pay, THEN THE Checklist_Generator SHALL remove that item before the Action Checklist is displayed.
7. IF Lumen is unavailable or returns an error when the checklist is requested, THEN THE Checklist_Generator SHALL display a message that the checklist could not be generated, offer a retry action, and retain the reviewed text in the Session.
8. WHEN the Action Checklist is displayed in a language, THE Checklist_Generator SHALL present all item text, group labels, and the cost hint in the language selected by the user.

### Requirement 17: Free Legal Help Finder

**User Story:** As a low-income user, I want to find free legal help near me, so that I can get a lawyer's guidance without paying.

#### Acceptance Criteria

1. WHEN the user selects a province and a city or municipality, THE Help_Finder SHALL list Providers in that city or municipality ordered by ascending distance from the center of the selected city or municipality, within 3 seconds of the selection.
2. WHERE the user grants browser location permission, THE Help_Finder SHALL order the Provider list by ascending distance from the device location instead of the selected city or municipality, within 5 seconds of the permission being granted.
3. THE Help_Finder SHALL include PAO offices, IBP Legal Aid offices, law school legal aid clinics, and barangay Lupon Tagapamayapa for the area, and SHALL display up to 20 Providers per list, showing the nearest first.
4. THE Help_Finder SHALL display for each Provider the name, the address, the operating hours, a map link, and the Provider type.
5. IF an operating hours value is not available for a Provider, THEN THE Help_Finder SHALL display "Hindi alam ang oras" in Filipino or "Hours not available" in English in place of the hours, and SHALL still display the Provider.
6. THE Help_Finder SHALL display the PAO indigency requirements, including the documents commonly requested, with a statement that the PAO office determines final eligibility.
7. THE Help_Finder SHALL display the date each Provider entry was last verified, in a format showing day, month, and year.
8. IF no Provider is found within the selected city or municipality, THEN THE Help_Finder SHALL list up to 10 Providers from the nearest areas, each with its distance in kilometers from the selected location, and SHALL display the PAO national contact channel.
9. WHEN the Notice type is assigned, THE Help_Finder SHALL visually mark the Provider types most relevant to the Notice type and SHALL still list all other Provider types.
10. IF the user denies location permission or the device location cannot be determined within 10 seconds, THEN THE Help_Finder SHALL display a message indicating that the location is unavailable and continue with manual province and city or municipality selection.
11. IF the Provider data cannot be loaded from the Supabase_Store, THEN THE Help_Finder SHALL display a message indicating that the list is unavailable, offer a retry action, and display the PAO national contact channel.

### Requirement 18: Questions to Ask Your Lawyer

**User Story:** As a user preparing for a consultation, I want a list of questions tailored to my notice, so that I use limited consultation time well.

#### Acceptance Criteria

1. WHEN the explanation is displayed, THE Question_Generator SHALL produce a list of 5 to 10 questions that reference the Notice type and, where present in the reviewed text, the parties and dates in the Notice, within 15 seconds.
2. THE Question_Generator SHALL include at least one question for each of these topics: deadlines, required documents, possible next steps, and expected costs.
3. THE Question_Generator SHALL present the questions in the language selected by the user.
4. WHEN the user changes the selected language, THE Question_Generator SHALL present the questions in the newly selected language, and user-added or user-edited questions SHALL remain unchanged.
5. WHEN the user adds a question, THE Question_Generator SHALL append it to the list, accepting 1 to 300 characters per question and a maximum of 20 questions in total.
6. IF the user submits an empty question, a question longer than 300 characters, or an addition that would exceed 20 questions, THEN THE Question_Generator SHALL reject the input, display a message stating the violated limit, and keep the existing list unchanged.
7. WHEN the user edits or removes a question, THE Question_Generator SHALL update the list immediately and retain the change for the rest of the Session, including in the Legal Preparation Report.
8. IF the Notice has no date identified as a deadline, THEN THE Question_Generator SHALL include a question asking the lawyer whether any deadline applies.
9. IF question generation fails or Lumen is unavailable, THEN THE Question_Generator SHALL display a message indicating that the questions could not be generated, offer a retry action, and keep any questions the user has already added or edited.
10. THE Question_Generator SHALL NOT include questions that ask the lawyer to predict a case outcome or that instruct the user on a legal decision, as defined in Requirement 15.

### Requirement 19: Exportable Legal Preparation Report

**User Story:** As a user, I want a one-page summary to bring to a lawyer or PAO office, so that I do not have to explain everything from scratch.

#### Acceptance Criteria

1. WHEN the user selects "Download report", THE Report_Generator SHALL produce a PDF of exactly one page containing the Notice type, key dates, parties, and Questions to Ask Your Lawyer.
2. THE Report_Generator SHALL include the "Hindi ito legal advice" disclaimer in the PDF.
3. THE Report_Generator SHALL include in the PDF the date the report was generated, in Philippine Standard Time, and a statement that the report was produced by an AI tool from a user-reviewed text.
4. WHERE Privacy-First Mode is enabled, THE Report_Generator SHALL use the redacted placeholders in the PDF unless the user chooses to include the original names before the PDF is generated.
5. THE Report_Generator SHALL produce the PDF in the language selected by the user.
6. IF the content does not fit on one page, THEN THE Report_Generator SHALL reduce the content to the Notice type, up to 5 key dates, up to 5 parties, and up to 10 questions, and SHALL keep the disclaimer and the generation statement on the page.
7. WHEN the user selects "Download report", THE Report_Generator SHALL generate the PDF within 10 seconds under normal network conditions.
8. IF the Notice text has no key dates, no parties, or no questions, THEN THE Report_Generator SHALL still produce the PDF and show a "not stated in the document" line in the language selected by the user in place of each empty section.
9. IF the PDF cannot be generated within 10 seconds or generation fails, THEN THE Report_Generator SHALL display a plain-language error message with a retry action and SHALL keep the reviewed text and the Session data unchanged.

### Requirement 20: Share with Family

**User Story:** As a user whose relative or OFW family member can help, I want to share a simple summary, so that they can understand my situation and assist me.

#### Acceptance Criteria

1. WHEN the user selects "Share with Family", THE Share_Service SHALL create a link to a read-only page containing only the Notice type, up to 5 key dates, and up to 10 recommended next steps from the Action Checklist, within 5 seconds.
2. WHEN the Share_Service creates the link, THE Share_Service SHALL display the link and its expiry date and time in Philippine Standard Time to the user before the user can copy the link.
3. THE Share_Service SHALL exclude the full Notice text and the uploaded file from the shared page.
4. WHERE Privacy-First Mode is enabled, THE Share_Service SHALL show the redacted placeholders on the shared page for each value the user has masked, and SHALL show the original value only for each value the user has unmasked.
5. THE Share_Service SHALL include the "Hindi ito legal advice" disclaimer on the shared page.
6. THE Share_Service SHALL generate each link with an unguessable identifier of at least 128 bits of randomness.
7. WHEN 24 hours have elapsed since the shared page was created, THE Share_Service SHALL delete the shared page from the Supabase_Store.
8. WHEN the user selects "Stop sharing" or "Delete my data", THE Share_Service SHALL delete the shared page from the Supabase_Store within 60 seconds and display a confirmation to the user.
9. IF a visitor opens a link whose shared page has been deleted or has expired, THEN THE Share_Service SHALL display a message stating that the page is no longer available and SHALL not display any Notice data.
10. IF the Share_Service fails to create the link, THEN THE Share_Service SHALL display an error message offering retry and SHALL keep the user's Session data unchanged.
11. THE shared page SHALL render without requiring login on mobile browser viewports of 360 px width and greater.

### Requirement 21: Text-to-Speech

**User Story:** As a senior or low-literacy user, I want the explanation read aloud, so that I can understand it without reading.

#### Acceptance Criteria

1. WHEN the user selects the listen button, THE TTS_Player SHALL begin reading the full text of the explanation aloud in the selected language within 2 seconds.
2. WHILE the TTS_Player is reading, THE TTS_Player SHALL display pause and stop controls, and WHILE the TTS_Player is paused or stopped, THE TTS_Player SHALL display a play control.
3. WHEN the user selects pause, THE TTS_Player SHALL stop audio within 1 second and resume from the same position when the user selects play.
4. WHEN the user selects stop, THE TTS_Player SHALL stop audio within 1 second and reset the reading position to the start of the explanation.
5. THE TTS_Player SHALL provide exactly three reading speeds: slow (0.75x), normal (1.0x), and fast (1.25x), with normal as the default.
6. WHEN the user changes the reading speed while reading, THE TTS_Player SHALL apply the new speed within 2 seconds without restarting from the beginning.
7. IF the device has no voice for the selected language, THEN THE TTS_Player SHALL display a message stating that read-aloud is unavailable for that language and offer the other language, if a voice for the other language is available.
8. IF the device has no voice for either Filipino or English, THEN THE TTS_Player SHALL display a message stating that read-aloud is unavailable on this device and disable the listen button.
9. WHEN the TTS_Player finishes reading the explanation, THE TTS_Player SHALL read the "Hindi ito legal advice" disclaimer, in the selected language, as the last spoken item.
10. IF the user changes the language while the TTS_Player is reading, THEN THE TTS_Player SHALL stop audio within 1 second and reset the reading position to the start.

### Requirement 22: Language and Accessibility

**User Story:** As a Filipino user of any age or education level, I want an interface I can easily use, so that I can finish the process without help.

#### Acceptance Criteria

1. WHEN the user opens LegaLinaw for the first time in a Session, THE LegaLinaw SHALL display the full interface in Filipino.
2. WHEN the user selects the language switch, THE LegaLinaw SHALL display the full interface in the selected language (Filipino or English) within 1 second and retain all entered data, including the reviewed text, in the Session.
3. THE LegaLinaw SHALL display body text at a minimum size of 16 px.
4. WHEN the user selects the text size option, THE LegaLinaw SHALL enlarge text to the selected level, with levels of 100, 150, and 200 percent, without loss of content or functionality and without horizontal scrolling at a 360 px viewport width.
5. THE LegaLinaw SHALL meet a contrast ratio of at least 4.5:1 for body text and at least 3:1 for large text and interface component boundaries, as defined by WCAG 2.1 Level AA.
6. THE LegaLinaw SHALL display and function on mobile browser viewports from 360 px to 1920 px width, with no horizontal scrolling of page content.
7. THE LegaLinaw SHALL display a step indicator showing the five stages (upload, review, explanation, follow-up questions, and legal help preparation) and SHALL mark the current stage and the completed stages.
8. THE LegaLinaw SHALL allow every interactive element to be reached and operated using only the keyboard, with a visible focus indicator on the focused element.
9. THE LegaLinaw SHALL provide text alternatives for non-text content and programmatic labels for form controls, so that all content and controls are announced by the screen readers VoiceOver, TalkBack, and NVDA.
10. WHILE a network request takes longer than 2 seconds, THE LegaLinaw SHALL display a loading state with a message in the selected language and retain the user's reviewed text in the Session.
11. IF a network request fails, THEN THE LegaLinaw SHALL display a message in the selected language offering a retry action, and SHALL preserve the reviewed text so that the user does not need to re-upload the file.

### Requirement 23: Guided Program Flow

**User Story:** As a user, I want to be guided step by step, so that I know what is happening and what comes next.

#### Acceptance Criteria

1. THE LegaLinaw SHALL present the stages in this fixed order: upload, OCR and review, explanation, Lumen AI follow-up questions, and legal help preparation.
2. WHILE a stage is not yet available, THE LegaLinaw SHALL prevent the user from entering that stage. A stage is available only after the previous stage is complete.
3. WHEN the user confirms the reviewed text with the "Tama ang text" confirmation, THE LegaLinaw SHALL show the explanation, scam check, deadline, and "What is this?" card on one screen within 30 seconds under normal network conditions.
4. IF the explanation, scam check, deadline, or "What is this?" card cannot be produced, THEN THE LegaLinaw SHALL show the sections that were produced, mark each failed section with a message and a retry action, and keep the reviewed text in the Session.
5. WHEN the explanation stage is complete, THE Chat_Assistant SHALL ask the user at least these two follow-up questions: whether the user has responded to the Notice, and whether the user has related documents.
6. WHEN the user answers or skips a follow-up question, THE Chat_Assistant SHALL record the answer or skip for the Session and present the next question. A skipped question SHALL NOT block the user from continuing.
7. WHEN all follow-up questions have been answered or skipped, THE LegaLinaw SHALL prepare the legal help direction containing the Action Checklist, the Help_Finder results, the Questions to Ask Your Lawyer, and the report download option.
8. WHEN the user goes back to a previous stage, THE LegaLinaw SHALL retain all of the user's edits, confirmations, chat answers, and checklist states made earlier in the Session.
9. WHEN a Session has been inactive for 30 minutes, THE LegaLinaw SHALL warn the user that the Session will end and offer a download summary action. IF the user does not interact within 5 minutes after the warning, THEN THE LegaLinaw SHALL end the Session.
10. WHEN the user interacts after the warning is shown and before the Session ends, THE LegaLinaw SHALL dismiss the warning and restart the 30-minute inactivity period.
11. IF the Session ends, THEN THE LegaLinaw SHALL delete the Session data as defined in Requirement 5.

### Requirement 24: Error Handling and Reliability

**User Story:** As a user, I want clear messages when something goes wrong, so that I am not left confused.

#### Acceptance Criteria

1. IF a request to Lumen returns an error, or receives no response within 30 seconds, THEN THE LegaLinaw SHALL display a message in the selected language stating that the AI service is unavailable, offer a retry action, and preserve the reviewed text and the user's edits in the Session.
2. IF Lumen is unavailable, THEN THE LegaLinaw SHALL keep the Help_Finder and the Sender_Verification_Guide accessible and functional, without requiring a Lumen response.
3. IF an unexpected error occurs, THEN THE LegaLinaw SHALL display a message in the selected language that states in plain words that something went wrong and offers a retry action, and SHALL preserve the reviewed text, the user's edits, and the checklist state in the Session.
4. THE LegaLinaw SHALL NOT display stack traces, technical error codes, or HTTP status codes in any user-facing message.
5. THE LegaLinaw SHALL transmit all data between the browser and the server over HTTPS.
6. IF a request is made over HTTP, THEN THE LegaLinaw SHALL refuse to process it over HTTP and SHALL redirect it to HTTPS.
7. THE LegaLinaw SHALL store the Lumen and Supabase credentials as server-side environment variables so that the credentials do not appear in any content, script, or network response delivered to the browser.
8. WHEN a Session sends its 21st Lumen request within a 10-minute window, THE LegaLinaw SHALL NOT send that request to Lumen, SHALL display a message in the selected language stating how many seconds remain until a request is allowed again, and SHALL preserve the reviewed text and the user's edits in the Session.
9. WHEN the 10-minute rate-limit window allows requests again, THE LegaLinaw SHALL remove the wait message and re-enable the actions that send requests to Lumen.

### Requirement 25: Serialization of Extracted Notice Data

**User Story:** As a developer, I want the structured notice data to survive saving and loading, so that downloads and shared summaries are accurate.

#### Acceptance Criteria

1. THE LegaLinaw SHALL represent the structured Notice data (type, key dates, parties, amounts, questions, checklist state) in a defined JSON schema in which each field is declared as required or optional, with a declared data type.
2. WHEN the user downloads the summary or the Share_Service creates a shared page, THE Serializer SHALL serialize the structured Notice data into JSON that conforms to the schema.
3. WHEN the Parser receives JSON, THE Parser SHALL validate the JSON against the schema and, if valid, return structured Notice data.
4. IF the Parser receives text that is not well-formed JSON, THEN THE Parser SHALL return an error indicating that the input is not valid JSON and SHALL NOT produce any structured Notice data.
5. IF the Parser receives well-formed JSON that does not conform to the schema, THEN THE Parser SHALL return an error identifying each non-conforming field by name and the reason, and SHALL NOT produce partial data.
6. IF the Serializer receives structured Notice data that does not conform to the schema, THEN THE Serializer SHALL return an error identifying each non-conforming field and SHALL NOT produce JSON output.
7. THE Serializer SHALL represent every date as an ISO 8601 date-time string with a Philippine Standard Time (UTC+8) offset, and SHALL encode text as UTF-8 so that Filipino characters (including "ñ") and special characters are preserved.
8. FOR ALL valid structured Notice data, including data with empty lists, optional fields absent, text of up to 100,000 characters, and up to 50 key dates, 50 parties, 50 amounts, and 50 questions, parsing the serialized JSON SHALL produce data equal to the original in every field (round-trip property).
