"""민수 AI 오피스 앱 아이콘 생성.

mascot_raw.png(수달 일러스트)를 크림색 테두리의 둥근 사각 아이콘으로 합성한다.
- 아이콘: 짙은 커피색 판 위에 수달 사진, 바깥 크림 테두리, 왼쪽 아래 데이지.
- 512 / 192 / 180(apple-touch) / 32(favicon) 사이즈와 헤더용 아바타를 만든다.
"""
from PIL import Image, ImageDraw, ImageFilter

SRC = "office_web/icons/mascot_raw.png"
OUT = "office_web/icons"

cream = (247, 235, 214, 255)
cream_light = (252, 246, 235, 255)
espresso = (38, 25, 16, 255)


def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return m


def build_icon(px):
    S = px * 4  # 고해상도로 그린 뒤 축소
    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)

    # 바깥: 크림 테두리 판
    pad = int(S * 0.02)
    d.rounded_rectangle((pad, pad, S - pad, S - pad), radius=int(S * 0.235), fill=cream)

    # 안쪽: 짙은 커피색 판
    inset = int(S * 0.075)
    d.rounded_rectangle(
        (inset, inset, S - inset, S - inset), radius=int(S * 0.2), fill=espresso
    )

    # 수달 사진(둥근 사각 크롭)
    art_box = int(S * 0.135)
    art_size = S - art_box * 2
    art = Image.open(SRC).convert("RGB")
    # 정사각 크롭(가운데)
    w, h = art.size
    side = min(w, h)
    art = art.crop(((w - side) // 2, (h - side) // 2, (w - side) // 2 + side, (h - side) // 2 + side))
    art = art.resize((art_size, art_size), Image.LANCZOS).convert("RGBA")
    art.putalpha(rounded_mask(art_size, int(art_size * 0.16)))
    canvas.alpha_composite(art, (art_box, art_box))

    # 데이지(왼쪽 아래)
    cx, cy = int(S * 0.175), int(S * 0.815)
    petal_long, petal_short = int(S * 0.072), int(S * 0.036)
    for i in range(8):
        import math

        ang = i * math.pi / 4
        px_ = cx + math.cos(ang) * petal_long * 0.62
        py_ = cy + math.sin(ang) * petal_long * 0.62
        petal = Image.new("RGBA", (petal_long * 2, petal_short * 2), (0, 0, 0, 0))
        pd = ImageDraw.Draw(petal)
        pd.ellipse((0, 0, petal_long * 2 - 1, petal_short * 2 - 1), fill=(255, 255, 255, 255))
        petal = petal.rotate(-math.degrees(ang), resample=Image.BICUBIC, expand=True)
        canvas.alpha_composite(
            petal, (int(px_ - petal.width / 2), int(py_ - petal.height / 2))
        )
    r = int(S * 0.031)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(243, 196, 63, 255))

    # 바깥 테두리에 부드러운 빛
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.rounded_rectangle(
        (pad, pad, S - pad, S - pad), radius=int(S * 0.235), outline=(255, 252, 244, 120), width=max(2, S // 90)
    )
    canvas.alpha_composite(glow)

    return canvas.resize((px, px), Image.LANCZOS)


def build_avatar(px):
    """헤더용 둥근 아바타(수달 얼굴 크롭)."""
    S = px * 4
    art = Image.open(SRC).convert("RGB")
    w, h = art.size
    # 얼굴 중심부 크롭
    box = (int(w * 0.17), int(h * 0.06), int(w * 0.83), int(h * 0.72))
    art = art.crop(box)
    side = max(art.size)
    sq = Image.new("RGB", (side, side), (243, 226, 199))
    sq.paste(art, ((side - art.width) // 2, (side - art.height) // 2))
    sq = sq.resize((S, S), Image.LANCZOS).convert("RGBA")
    sq.putalpha(rounded_mask(S, S // 2))
    base = Image.new("RGBA", (S, S), (247, 235, 214, 255))
    base.putalpha(rounded_mask(S, S // 2))
    base.alpha_composite(sq)
    ring = ImageDraw.Draw(base)
    ring.ellipse((0, 0, S - 1, S - 1), outline=(255, 252, 243, 255), width=max(2, S // 40))
    return base.resize((px, px), Image.LANCZOS)


for size in (512, 192, 180, 32):
    img = build_icon(size)
    name = f"{OUT}/icon-{size}.png"
    img.save(name)
    print("saved", name)

build_avatar(256).save(f"{OUT}/avatar-256.png")
print("saved", f"{OUT}/avatar-256.png")

# 마스커블 아이콘(안드로이드 적응형): 안전 영역 확보를 위해 78%로 축소해 배치
base = build_icon(512 * 4 // 4)
canvas = Image.new("RGBA", (512, 512), (247, 235, 214, 255))
inner = base.resize((int(512 * 0.78), int(512 * 0.78)), Image.LANCZOS)
off = (512 - inner.width) // 2
canvas.alpha_composite(inner, (off, off))
canvas.save(f"{OUT}/icon-maskable-512.png")
print("saved", f"{OUT}/icon-maskable-512.png")
