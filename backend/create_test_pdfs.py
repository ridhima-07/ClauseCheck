from pathlib import Path
import pymupdf

folder = Path(__file__).parent

# Empty file
(folder / "empty.pdf").write_bytes(b"")

# Invalid PDF content
(folder / "invalid.pdf").write_bytes(b"This is not a PDF.")

with pymupdf.open() as pdf:
    page = pdf.new_page()
    page.insert_text((72, 72), "ClauseCheck validation test.")

    # PNG image disguised with a .pdf extension
    image_bytes = page.get_pixmap().tobytes("png")
    (folder / "disguised_image.pdf").write_bytes(image_bytes)

    # PDF requiring a password
    pdf.save(
        folder / "locked.pdf",
        encryption=pymupdf.PDF_ENCRYPT_AES_256,
        owner_pw="owner-test",
        user_pw="user-test",
    )

print(f"Created all four test files in: {folder}")

# Valid PDF containing one blank page
with pymupdf.open() as pdf:
    pdf.new_page()
    pdf.save(folder / "blank.pdf")

print("Created blank.pdf")