"""뮤즈 공장 앱 아이콘 생성 (초록 테마).

mew_raw.png(포켓몬 뮤 스타일 일러스트)를 세이지 그린 판 위의 둥근 사각 아이콘으로 합성한다.
- 아이콘: 밝은 세이지 판 + 안쪽 세이지 판 위에 뮤 원화, 딥 그린 헤어라인.
- 512 / 192 / 180(apple-touch) / 32(favicon) 사이즈와 헤더용 아바타를 만든다.
"""
from PIL import Image, ImageDraw

SRC = "office_web/icons/mew_raw.png"
OUT = "office_web/icons"

# 세이지/포레스트 그린 팔레트 (styles.css와 동일 계열)
sage_pale = (244, 250, 241)   # 바깥 판
sage = (225, 238, 218)        # 안쪽 판
art_bg = (205, 227, 198)      # 원화 크롭 배경(생성 이미지 판 색)


def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return m


def square_crop(img, bg):
    """생성 이미지의 검은 모서리(안티앨리어싱 테두리 포함)를 배경색으로 채우고 정사각 크롭."""
    from collections import deque

    img = img.convert("RGB")
    w, h = img.size
    px = img.load()

    def dark(x, y):
        r, g, b = px[x, y]
        return max(r, g, b) < 140 and (max(r, g, b) - min(r, g, b)) < 40

    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if dark(x, y) and not seen[y * w + x]:
                seen[y * w + x] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if dark(x, y) and not seen[y * w + x]:
                seen[y * w + x] = 1
                q.append((x, y))
    while q:
        x, y = q.popleft()
        px[x, y] = bg
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and dark(nx, ny):
                seen[ny * w + nx] = 1
                q.append((nx, ny))

    side = min(w, h)
    pad = int(side * 0.055)  # 생성 이미지 판 테두리 안쪽으로 크롭
    return img.crop(
        (
            (w - side) // 2 + pad,
            (h - side) // 2 + pad,
            (w - side) // 2 + side - pad,
            (h - side) // 2 + side - pad,
        )
    )


ART_CACHE = {}


def art_at(size):
    """원하는 크기의 둥근 사각 뮤 원화(RGBA)."""
    if size not in ART_CACHE:
        art = square_crop(Image.open(SRC), art_bg).resize((size, size), Image.LANCZOS).convert("RGBA")
        art.putalpha(rounded_mask(size, int(size * 0.16)))
        ART_CACHE[size] = art
    return ART_CACHE[size].copy()


def build_icon(px):
    """px 크기 아이콘. 전면이 채워진(모서리 투명 없는) 정사각 이미지."""
    # 판은 4배 해상도로 그리고, 원화는 최종 크기에 맞춰 붙여 리샘플 링잉을 피한다.
    S = px * 4
    plate = Image.new("RGBA", (S, S), sage_pale + (255,))
    d = ImageDraw.Draw(plate)

    # 안쪽: 세이지 판
    inset = int(S * 0.075)
    d.rounded_rectangle((inset, inset, S - inset, S - inset), radius=int(S * 0.2), fill=sage + (255,))

    # 바깥 테두리에 부드러운 빛
    pad = int(S * 0.02)
    d.rounded_rectangle(
        (pad, pad, S - pad, S - pad),
        radius=int(S * 0.235),
        outline=(255, 255, 255, 150),
        width=max(2, S // 90),
    )
    plate = plate.resize((px, px), Image.LANCZOS)

    # 뮤 원화
    art_box = int(px * 0.135)
    art_size = px - art_box * 2
    plate.alpha_composite(art_at(art_size), (art_box, art_box))

    # 원화 테두리에 딥 그린 헤어라인
    hair = ImageDraw.Draw(plate)
    hair.rounded_rectangle(
        (art_box, art_box, art_box + art_size - 1, art_box + art_size - 1),
        radius=int(art_size * 0.16),
        outline=(31, 61, 45, 55),
        width=max(1, px // 260),
    )
    return plate


def build_avatar(px):
    """헤더용 둥근 아바타(뮤 얼굴 크롭)."""
    art = square_crop(Image.open(SRC), art_bg)
    w, h = art.size
    # 얼굴 중심부 크롭(원화 기준 비율)
    box = (int(w * 0.16), int(h * 0.02), int(w * 0.68), int(h * 0.54))
    face = art.crop(box)
    side = max(face.size)
    sq = Image.new("RGB", (side, side), art_bg)
    sq.paste(face, ((side - face.width) // 2, (side - face.height) // 2))
    sq = sq.resize((px, px), Image.LANCZOS).convert("RGBA")
    sq.putalpha(rounded_mask(px, px // 2))

    base = Image.new("RGBA", (px, px), sage_pale + (255,))
    base.putalpha(rounded_mask(px, px // 2))
    base.alpha_composite(sq)
    ring = ImageDraw.Draw(base)
    ring.ellipse((0, 0, px - 1, px - 1), outline=(255, 255, 255, 255), width=max(2, px // 40))
    return base


for size in (512, 192, 180, 32):
    img = build_icon(size)
    name = f"{OUT}/icon-{size}.png"
    img.save(name)
    print("saved", name)

build_avatar(256).save(f"{OUT}/avatar-256.png")
print("saved", f"{OUT}/avatar-256.png")

# 마스커블 아이콘(안드로이드 적응형): 안전 영역 확보를 위해 78%로 축소해 배치
base = build_icon(512)
canvas = Image.new("RGBA", (512, 512), sage_pale + (255,))
inner = base.resize((int(512 * 0.78), int(512 * 0.78)), Image.LANCZOS)
off = (512 - inner.width) // 2
canvas.alpha_composite(inner, (off, off))
canvas.save(f"{OUT}/icon-maskable-512.png")
print("saved", f"{OUT}/icon-maskable-512.png")
