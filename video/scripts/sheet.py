import sys
from PIL import Image
out, *files = sys.argv[1:]
cols = 2
rows = (len(files) + 1) // 2
sheet = Image.new("RGB", (1920, 540 * rows), "white")
for i, f in enumerate(files):
    sheet.paste(Image.open(f).convert("RGB").resize((960, 540)), ((i % 2) * 960, (i // 2) * 540))
sheet.save(out)
