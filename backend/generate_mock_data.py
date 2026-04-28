"""
Mock Data Generator
Creates realistic sample documents for testing the DocIntel pipeline.
Generates PDFs, DOCX files, emails, and text files with legal content.
"""

import os
import sys
import uuid
import random
from datetime import datetime, timedelta
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from faker import Faker
from fpdf import FPDF

fake = Faker()

MOCK_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "mock_data")
os.makedirs(MOCK_DIR, exist_ok=True)


def generate_contract_pdf(filename: str):
    """Generate a realistic legal contract PDF."""
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)

    party_a = fake.company()
    party_b = fake.company()
    lawyer_a = fake.name()
    lawyer_b = fake.name()
    contract_date = fake.date_between(start_date="-2y", end_date="today")
    amount = random.randint(50000, 5000000)
    term_years = random.randint(1, 5)

    pdf.cell(0, 10, "PROFESSIONAL SERVICES AGREEMENT", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    pdf.set_font("Helvetica", "", 10)

    contract_text = f"""
CONTRACT NUMBER: {fake.bothify('CT-####-???').upper()}
DATE: {contract_date.strftime('%B %d, %Y')}

This Professional Services Agreement ("Agreement") is entered into as of {contract_date.strftime('%B %d, %Y')} 
by and between:

PARTY A: {party_a}
Address: {fake.address()}
Represented by: {lawyer_a}, General Counsel

AND

PARTY B: {party_b}
Address: {fake.address()}
Represented by: {lawyer_b}, Attorney at Law

RECITALS

WHEREAS, {party_a} desires to engage {party_b} for professional consulting services 
related to {fake.bs()};

WHEREAS, {party_b} possesses the expertise and capability to perform such services;

NOW, THEREFORE, in consideration of the mutual covenants and agreements herein contained, 
the parties agree as follows:

1. SCOPE OF SERVICES
{party_b} shall provide the following services:
a) {fake.bs()}
b) {fake.bs()}
c) Strategic advisory and implementation support
d) Quarterly performance reviews and reporting

2. TERM
This Agreement shall commence on {contract_date.strftime('%B %d, %Y')} and shall continue 
for a period of {term_years} year(s), unless earlier terminated in accordance with Section 8.

3. COMPENSATION
{party_a} shall pay {party_b} a total fee of ${amount:,}.00 USD, payable as follows:
- Initial payment of ${amount // 4:,}.00 upon execution
- Monthly installments of ${amount // (term_years * 12):,}.00
- Performance bonus up to ${amount // 10:,}.00 upon satisfactory completion

4. CONFIDENTIALITY
Both parties agree to maintain strict confidentiality of all proprietary information 
exchanged during the course of this Agreement. This obligation shall survive termination 
for a period of 3 years.

5. INTELLECTUAL PROPERTY
All work product created under this Agreement shall be the sole property of {party_a}.
{party_b} hereby assigns all rights, title, and interest.

6. INDEMNIFICATION
Each party shall indemnify and hold harmless the other party from any claims, damages, 
losses, or expenses arising from breach of this Agreement or negligent acts.

7. LIMITATION OF LIABILITY
In no event shall either party's total liability exceed the total fees paid under 
this Agreement, except in cases of gross negligence or willful misconduct.

8. TERMINATION
Either party may terminate this Agreement with 30 days written notice. In the event of 
material breach, the non-breaching party may terminate immediately upon written notice.

9. GOVERNING LAW
This Agreement shall be governed by the laws of the State of {fake.state()}.

10. DISPUTE RESOLUTION
Any disputes arising under this Agreement shall be resolved through binding arbitration 
in accordance with the rules of the American Arbitration Association.

SPECIAL CLAUSE - AMENDMENT TO PAYMENT TERMS:
Notwithstanding Section 3, payment terms may be modified upon mutual written agreement.
Late payments shall accrue interest at a rate of 1.5% per month.

NOTE: This contract supersedes the previous agreement dated {(contract_date - timedelta(days=random.randint(30, 365))).strftime('%B %d, %Y')}.
There appear to be discrepancies with the original NDA signed on {(contract_date - timedelta(days=random.randint(60, 400))).strftime('%B %d, %Y')}.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first above written.

___________________________          ___________________________
{lawyer_a}                            {lawyer_b}
For {party_a}                         For {party_b}
Date: {contract_date.strftime('%B %d, %Y')}            Date: {contract_date.strftime('%B %d, %Y')}
"""

    for line in contract_text.split("\n"):
        txt = line.strip()
        if txt:
            pdf.multi_cell(w=pdf.w - pdf.l_margin - pdf.r_margin, h=5, text=txt)
        else:
            pdf.ln(3)

    filepath = os.path.join(MOCK_DIR, filename)
    pdf.output(filepath)
    return filepath


def generate_email_file(filename: str):
    """Generate a mock email .eml file."""
    sender = fake.email()
    recipient = fake.email()
    cc = fake.email()
    date = fake.date_time_between(start_date="-1y", end_date="now")
    subject_options = [
        f"Re: Case #{fake.bothify('####')} - Urgent Update",
        f"Fw: Settlement Discussion - {fake.company()}",
        f"Document Review Request - {fake.company()} v. {fake.company()}",
        f"CONFIDENTIAL: Deposition Summary - {fake.name()}",
        f"Action Required: Filing Deadline {fake.date_this_month().strftime('%B %d')}",
    ]
    subject = random.choice(subject_options)

    body = f"""Dear {fake.name()},

I am writing regarding the ongoing matter of {fake.company()} v. {fake.company()} 
(Case No. {fake.bothify('##-CV-####')}).

{random.choice([
    'Following our discussion yesterday, I have reviewed the depositions and identified '
    'several inconsistencies that need to be addressed before the next hearing.',
    
    'Please find attached the revised settlement proposal. The opposing counsel has '
    'agreed to the modified terms outlined in Section 4, but has raised concerns about '
    'the indemnification clause.',
    
    'I wanted to flag a potential issue with the witness testimony from the deposition '
    'taken on ' + fake.date_this_year().strftime('%B %d, %Y') + '. There are notable '
    'discrepancies between the written statement and the oral testimony.',
    
    'After careful review of the financial documents, our forensic accountant has '
    'identified approximately $' + str(random.randint(100000, 10000000)) + ' in '
    'unreported transactions that warrant further investigation.',
])}

Key action items:
1. Review the attached documents by {fake.date_between(start_date='today', end_date='+30d').strftime('%B %d, %Y')}
2. Schedule a meeting with {fake.name()} to discuss findings
3. Prepare response to opposing counsel's motion filed on {fake.date_this_month().strftime('%B %d, %Y')}
4. Update the case timeline with new evidence

Please treat this communication as attorney-client privileged and confidential.

Best regards,
{fake.name()}
{fake.job()}
{fake.company()}
{fake.phone_number()}
"""

    eml_content = f"""From: {sender}
To: {recipient}
Cc: {cc}
Subject: {subject}
Date: {date.strftime('%a, %d %b %Y %H:%M:%S +0000')}
MIME-Version: 1.0
Content-Type: text/plain; charset="utf-8"

{body}
"""

    filepath = os.path.join(MOCK_DIR, filename)
    with open(filepath, "w") as f:
        f.write(eml_content)
    return filepath


def generate_transcript_txt(filename: str):
    """Generate a mock deposition/court transcript."""
    case_number = fake.bothify("##-CV-####")
    judge = fake.name()
    witness = fake.name()
    attorney_a = fake.name()
    attorney_b = fake.name()
    depo_date = fake.date_between(start_date="-1y", end_date="today")

    transcript = f"""UNITED STATES DISTRICT COURT
NORTHERN DISTRICT OF {fake.state().upper()}

Case No.: {case_number}
{fake.company().upper()} v. {fake.company().upper()}

DEPOSITION OF {witness.upper()}
Date: {depo_date.strftime('%B %d, %Y')}
Location: {fake.address()}

Before the Honorable Judge {judge}

APPEARANCES:
For the Plaintiff: {attorney_a}, Esq.
For the Defendant: {attorney_b}, Esq.

---

THE COURT REPORTER: This deposition is being taken pursuant to notice.
The witness has been sworn.

EXAMINATION BY {attorney_a.upper().split()[1]}:

Q: Please state your full name for the record.
A: My name is {witness}.

Q: And what is your current occupation?
A: I am a {fake.job()} at {fake.company()}.

Q: How long have you held that position?
A: Approximately {random.randint(2, 15)} years.

Q: Can you describe your involvement with the events in question?
A: Yes. On or about {fake.date_between(start_date='-2y', end_date='-6m').strftime('%B %d, %Y')}, 
I was contacted by {fake.name()} regarding a matter involving {fake.bs()}.

Q: And what happened next?
A: I was asked to review certain financial documents related to transactions 
totaling approximately ${random.randint(100000, 5000000):,}. During my review, 
I noticed several irregularities.

Q: Can you describe these irregularities?
A: There were multiple payments to entities that appeared to be shell companies. 
The amounts were always just under $10,000, which seemed designed to avoid 
reporting requirements. Additionally, some invoices were backdated.

{attorney_b.upper().split()[1]}: Objection. Speculation.
THE COURT: Overruled. The witness may continue.

A: As I was saying, the invoices appeared to be backdated by several months. 
I also found discrepancies between the internal ledger and the bank statements 
provided to auditors.

Q: Did you report these findings to anyone?
A: Yes, I reported them to {fake.name()}, the Chief Financial Officer, 
on {fake.date_between(start_date='-1y', end_date='-3m').strftime('%B %d, %Y')}.

Q: What was the response?
A: I was told to "not worry about it" and to focus on other matters.

{attorney_b.upper().split()[1]}: Objection. Hearsay.
THE COURT: Sustained as to the characterization. Please limit your testimony 
to direct observations.

Q: Without characterizing what was said, what actions were taken after your report?
A: No formal investigation was initiated to my knowledge. The documents in question 
were subsequently moved to a restricted access folder.

Q: Do you have any documentation supporting your testimony?
A: Yes, I retained copies of the original documents and my analysis report 
dated {fake.date_between(start_date='-1y', end_date='-3m').strftime('%B %d, %Y')}.

[TRANSCRIPT CONTINUES - Pages {random.randint(50, 200)}-{random.randint(201, 400)}]

---
CERTIFICATE OF REPORTER

I, {fake.name()}, Certified Court Reporter, hereby certify that the foregoing 
is a true and accurate transcript of the proceedings taken in the above-entitled matter.

Date: {depo_date.strftime('%B %d, %Y')}
"""

    filepath = os.path.join(MOCK_DIR, filename)
    with open(filepath, "w") as f:
        f.write(transcript)
    return filepath


def generate_financial_report_pdf(filename: str):
    """Generate a mock financial report PDF."""
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)

    company = fake.company()
    report_date = fake.date_between(start_date="-6m", end_date="today")

    pdf.cell(0, 10, f"FINANCIAL ANALYSIS REPORT", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)

    revenue = random.randint(1000000, 50000000)
    expenses = int(revenue * random.uniform(0.6, 0.95))

    report_text = f"""
Company: {company}
Report Period: Q{random.randint(1, 4)} {report_date.year}
Prepared by: {fake.name()}, CPA
Date: {report_date.strftime('%B %d, %Y')}

EXECUTIVE SUMMARY

This financial analysis covers the operations of {company} for the reporting period.
Total revenue was ${revenue:,}, with total operating expenses of ${expenses:,}.
Net income was ${revenue - expenses:,}, representing a {((revenue - expenses) / revenue * 100):.1f}% margin.

KEY FINDINGS:

1. Revenue increased by {random.randint(5, 30)}% compared to the previous quarter
2. Operating expenses grew by {random.randint(2, 25)}%
3. Accounts receivable aging shows ${random.randint(100000, 2000000):,} in receivables over 90 days
4. Several vendor payments lack proper documentation
5. Travel and entertainment expenses exceeded budget by {random.randint(10, 50)}%

AREAS OF CONCERN:

- Unusual transactions totaling ${random.randint(50000, 500000):,} to offshore accounts
- Missing receipts for {random.randint(5, 30)} expense reports
- Discrepancy of ${random.randint(10000, 100000):,} between reported and actual inventory values
- Board-approved budget exceeded in 3 of 5 departments

RECOMMENDATIONS:

1. Implement enhanced controls for wire transfers exceeding $25,000
2. Conduct forensic audit of accounts payable for the past 18 months
3. Review and update the vendor approval process
4. Strengthen documentation requirements for executive expenses

This report is confidential and intended solely for the use of the board of directors.
"""

    for line in report_text.split("\n"):
        txt = line.strip()
        if txt:
            pdf.multi_cell(w=pdf.w - pdf.l_margin - pdf.r_margin, h=5, text=txt)
        else:
            pdf.ln(3)

    filepath = os.path.join(MOCK_DIR, filename)
    pdf.output(filepath)
    return filepath


def generate_witness_statement_txt(filename: str):
    """Generate a mock witness statement."""
    witness = fake.name()
    date = fake.date_between(start_date="-1y", end_date="today")

    statement = f"""WITNESS STATEMENT

Case Reference: {fake.bothify('WS-####-???').upper()}
Witness Name: {witness}
Date of Birth: {fake.date_of_birth(minimum_age=25, maximum_age=65).strftime('%B %d, %Y')}
Occupation: {fake.job()}
Address: {fake.address()}
Date of Statement: {date.strftime('%B %d, %Y')}

I, {witness}, make this statement of my own free will. I understand that it may be 
used as evidence in legal proceedings.

STATEMENT:

On {fake.date_between(start_date='-2y', end_date='-3m').strftime('%B %d, %Y')}, at approximately 
{random.randint(8, 18)}:{random.choice(['00', '15', '30', '45'])} hours, I was present at 
{fake.address()} in my capacity as {fake.job()}.

I observed {fake.name()} and {fake.name()} engaged in a meeting in the conference room 
on the {random.choice(['3rd', '5th', '7th', '10th'])} floor. While I was not party to the 
meeting, I could hear raised voices and the following was clearly stated:

"{random.choice([
    'We need to make these numbers disappear before the audit.',
    'The board cannot know about this arrangement.',
    'If this gets out, we are all going to prison.',
    'Transfer the funds through the subsidiary before end of quarter.',
    'Destroy the original documents and replace them with the revised versions.',
])}"

I immediately documented what I heard and reported it to {fake.name()}, 
the {random.choice(['Compliance Officer', 'General Counsel', 'VP of Operations'])} 
on {fake.date_between(start_date='-1y', end_date='-2m').strftime('%B %d, %Y')}.

I have no personal interest in the outcome of this case and have provided this 
statement voluntarily.

Signed: {witness}
Date: {date.strftime('%B %d, %Y')}
Witnessed by: {fake.name()}, Notary Public
"""

    filepath = os.path.join(MOCK_DIR, filename)
    with open(filepath, "w") as f:
        f.write(statement)
    return filepath


def generate_memo_txt(filename: str):
    """Generate an internal memo."""
    from_person = fake.name()
    to_person = fake.name()
    date = fake.date_between(start_date="-1y", end_date="today")

    memo = f"""INTERNAL MEMORANDUM
CONFIDENTIAL - ATTORNEY WORK PRODUCT

TO: {to_person}, {random.choice(['Managing Partner', 'Senior Associate', 'Department Head'])}
FROM: {from_person}, {random.choice(['Associate', 'Paralegal', 'Research Analyst'])}
DATE: {date.strftime('%B %d, %Y')}
RE: Case Analysis - {fake.company()} Matter

{'-' * 60}

SUMMARY OF FINDINGS:

Following my review of the documents produced in discovery, I have identified 
the following issues that require immediate attention:

1. DOCUMENT INCONSISTENCIES
   - The executed version of the {random.choice(['merger agreement', 'licensing contract', 'service agreement'])} 
     dated {fake.date_between(start_date='-2y', end_date='-6m').strftime('%B %d, %Y')} differs 
     materially from the draft version in our files
   - Key changes include modifications to the {random.choice(['indemnification clause', 'non-compete provision', 'payment terms', 'governing law section'])}
   - These changes were not authorized by {fake.name()}

2. TIMELINE DISCREPANCIES
   - The respondent claims the agreement was signed on {fake.date_between(start_date='-2y', end_date='-1y').strftime('%B %d, %Y')}
   - However, email metadata suggests the document was created {random.randint(2, 8)} weeks later
   - This raises questions about the authenticity of the signed version

3. FINANCIAL IRREGULARITIES
   - Wire transfer records show ${random.randint(100000, 5000000):,} in payments 
     to an entity not disclosed in the original agreement
   - The receiving entity appears to be controlled by {fake.name()}, 
     a {random.choice(['board member', 'former employee', 'undisclosed related party'])}

RECOMMENDED ACTIONS:
- Subpoena bank records for the period {fake.date_between(start_date='-2y', end_date='-1y').strftime('%B %Y')} 
  through {fake.date_between(start_date='-1y', end_date='today').strftime('%B %Y')}
- Depose {fake.name()} regarding knowledge of the undisclosed payments
- Engage forensic document examiner to verify authenticity of signatures
- File motion to compel production of all communications with {fake.company()}

DEADLINE: Response due by {fake.date_between(start_date='today', end_date='+30d').strftime('%B %d, %Y')}

Please advise on how to proceed.
"""

    filepath = os.path.join(MOCK_DIR, filename)
    with open(filepath, "w") as f:
        f.write(memo)
    return filepath


def generate_mock_dataset():
    """Generate a complete mock dataset for testing."""
    print("Generating mock legal documents...")

    files = []

    # Generate contracts (PDFs)
    for i in range(4):
        filename = f"contract_{i + 1}.pdf"
        filepath = generate_contract_pdf(filename)
        files.append(filepath)
        print(f"  ✓ {filename}")

    # Generate emails
    for i in range(4):
        filename = f"email_correspondence_{i + 1}.eml"
        filepath = generate_email_file(filename)
        files.append(filepath)
        print(f"  ✓ {filename}")

    # Generate transcripts
    for i in range(3):
        filename = f"deposition_transcript_{i + 1}.txt"
        filepath = generate_transcript_txt(filename)
        files.append(filepath)
        print(f"  ✓ {filename}")

    # Generate financial reports
    for i in range(2):
        filename = f"financial_report_{i + 1}.pdf"
        filepath = generate_financial_report_pdf(filename)
        files.append(filepath)
        print(f"  ✓ {filename}")

    # Generate witness statements
    for i in range(2):
        filename = f"witness_statement_{i + 1}.txt"
        filepath = generate_witness_statement_txt(filename)
        files.append(filepath)
        print(f"  ✓ {filename}")

    # Generate memos
    for i in range(2):
        filename = f"internal_memo_{i + 1}.txt"
        filepath = generate_memo_txt(filename)
        files.append(filepath)
        print(f"  ✓ {filename}")

    # Create a near-duplicate (copy with slight modification)
    import shutil
    src = os.path.join(MOCK_DIR, "witness_statement_1.txt")
    dup = os.path.join(MOCK_DIR, "witness_statement_1_revised.txt")
    if os.path.exists(src):
        with open(src, "r") as f:
            content = f.read()
        # Make slight modifications
        content = content.replace("WITNESS STATEMENT", "WITNESS STATEMENT (REVISED)")
        content += "\n\nADDENDUM: Minor corrections applied to original statement."
        with open(dup, "w") as f:
            f.write(content)
        files.append(dup)
        print(f"  ✓ witness_statement_1_revised.txt (near-duplicate)")

    # Create an exact duplicate
    exact_dup = os.path.join(MOCK_DIR, "email_correspondence_1_copy.eml")
    src_email = os.path.join(MOCK_DIR, "email_correspondence_1.eml")
    if os.path.exists(src_email):
        shutil.copy2(src_email, exact_dup)
        files.append(exact_dup)
        print(f"  ✓ email_correspondence_1_copy.eml (exact duplicate)")

    # Generate Image (for OCR testing)
    try:
        from PIL import Image, ImageDraw, ImageFont
        img = Image.new('RGB', (800, 600), color=(255, 255, 255))
        d = ImageDraw.Draw(img)
        d.text((50, 50), "SCANNED EVIDENCE RECEIPT", fill=(0, 0, 0))
        d.text((50, 100), f"Receipt No: {fake.bothify('RC-####')}", fill=(0, 0, 0))
        d.text((50, 150), f"Date: {fake.date_this_year().strftime('%B %d, %Y')}", fill=(0, 0, 0))
        d.text((50, 200), f"Amount Paid: ${random.randint(1000, 50000)}.00", fill=(0, 0, 0))
        d.text((50, 250), "Note: This is a cash transaction not recorded in the ledger.", fill=(200, 0, 0))
        img_path = os.path.join(MOCK_DIR, "scanned_receipt.jpg")
        img.save(img_path)
        files.append(img_path)
        print(f"  ✓ scanned_receipt.jpg (OCR image)")
    except Exception as e:
        print(f"  ✗ Skipped image generation (PIL not available or error: {e})")

    print(f"\n✅ Generated {len(files)} mock documents in: {MOCK_DIR}")
    return files


if __name__ == "__main__":
    generate_mock_dataset()
