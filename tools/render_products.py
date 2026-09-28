"""Create placeholder bandana references; replace these with real product photos."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter


OUT = Path(__file__).resolve().parents[1] / "public" / "assets"
SIZE = (800, 650)
POLYGON = [(80, 145), (720, 145), (400, 570)]
STYLES = {
    "cherry": ((255, 242, 229), (190, 55, 53), "cherry"),
    "sky": ((225, 243, 246), (71, 122, 154), "check"),
    "daisy": ((247, 213, 101), (245, 250, 227), "daisy"),
    "forest": ((185, 209, 174), (46, 94, 71), "leaf"),
}


def create(name, fabric, trim, motif):
    mask = Image.new("L", SIZE)
    draw = ImageDraw.Draw(mask)
    draw.polygon(POLYGON, fill=255)
    face = Image.new("RGBA", SIZE, (*fabric, 255))
    art = ImageDraw.Draw(face, "RGBA")

    if motif == "check":
        for x in range(0, 800, 56):
            art.rectangle((x, 0, x + 19, 650), fill=(65, 129, 169, 53))
            art.line((x + 25, 0, x + 25, 650), fill=(45, 105, 150, 55), width=3)
        for y in range(0, 650, 56):
            art.rectangle((0, y, 800, y + 19), fill=(65, 129, 169, 53))
            art.line((0, y + 25, 800, y + 25), fill=(45, 105, 150, 55), width=3)
    elif motif == "cherry":
        for row, y in enumerate(range(175, 550, 83)):
            for x in range(130 + (row % 2) * 38, 720, 85):
                art.arc((x - 3, y - 20, x + 27, y + 12), 185, 290, fill=(65, 116, 74, 230), width=4)
                art.line((x + 11, y - 14, x + 19, y - 24), fill=(65, 116, 74, 230), width=4)
                art.ellipse((x - 5, y, x + 18, y + 23), fill=(214, 49, 56, 245))
                art.ellipse((x + 15, y - 3, x + 38, y + 20), fill=(194, 39, 49, 245))
                art.ellipse((x + 1, y + 3, x + 5, y + 7), fill=(255, 220, 212, 190))
    elif motif == "daisy":
        for row, y in enumerate(range(183, 550, 93)):
            for x in range(135 + (row % 2) * 46, 700, 98):
                for dx, dy in ((0, -17), (16, -5), (10, 13), (-10, 13), (-16, -5)):
                    art.ellipse((x + dx - 9, y + dy - 10, x + dx + 9, y + dy + 10), fill=(255, 251, 232, 245))
                art.ellipse((x - 7, y - 7, x + 7, y + 7), fill=(185, 126, 55, 255))
    else:
        for row, y in enumerate(range(180, 550, 82)):
            for x in range(130 + (row % 2) * 37, 715, 88):
                art.line((x - 17, y + 20, x + 23, y - 18), fill=(48, 101, 73, 195), width=4)
                art.ellipse((x - 28, y - 2, x + 2, y + 18), fill=(48, 101, 73, 215))
                art.ellipse((x + 2, y - 20, x + 33, y), fill=(64, 122, 82, 220))

    face.putalpha(mask)
    image = Image.new("RGBA", SIZE)
    image.alpha_composite(face)
    details = ImageDraw.Draw(image, "RGBA")
    details.line([(80, 145), (400, 570), (720, 145)], fill=(*trim, 255), width=20, joint="curve")
    details.line([(106, 154), (400, 539), (694, 154)], fill=(255, 255, 255, 135), width=3, joint="curve")
    details.polygon([(83, 137), (717, 137), (697, 187), (102, 187)], fill=(*trim, 255))
    details.line((103, 175, 697, 175), fill=(255, 255, 255, 135), width=3)
    details.line((104, 189, 696, 189), fill=(30, 43, 35, 50), width=4)
    details.ellipse((386, 151, 414, 179), fill=(255, 253, 237, 205))
    details.ellipse((395, 160, 405, 170), fill=(*trim, 255))
    image.save(OUT / f"{name}.png", optimize=True)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for style, (base, edge, pattern) in STYLES.items():
        create(style, base, edge, pattern)
