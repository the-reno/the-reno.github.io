"""Encode the three imagegen masters for the gallery and a quiet 20-second film.

Requirements: Pillow and FFmpeg with libx264. Does not generate or retouch art.
Run from any directory: python scripts/build_night_film.py
"""
from pathlib import Path
import subprocess
from PIL import Image

assets = Path(__file__).resolve().parents[1] / 'docs' / 'assets'
names = ('football-night-hd', 'manhattan-reflections-hd', 'night-runner-hd')
inputs = []
filters = []
for index, name in enumerate(names):
    source = assets / (name + '.png')
    with Image.open(source) as image:
        image.save(assets / (name + '.webp'), format='WEBP', quality=94, method=6)
    inputs.extend(['-i', str(source)])
    focus = (0.5, 0.68, 0.4)[index]
    filters.append(
        f'[{index}:v]scale=3840:1608:force_original_aspect_ratio=increase,'
        "crop=3840:1608,zoompan=z='1+0.018*on/239':"
        f"x='(iw-iw/zoom)*{focus}':y='(ih-ih/zoom)*0.5':"
        f'd=240:s=1920x804:fps=30,format=yuv420p,settb=AVTB,setpts=PTS-STARTPTS[v{index}]'
    )
filters.extend([
    '[v0][v1]xfade=transition=fade:duration=2:offset=6[v01]',
    '[v01][v2]xfade=transition=fade:duration=2:offset=12,format=yuv420p[out]',
])
subprocess.run([
    'ffmpeg', '-hide_banner', '-loglevel', 'warning', '-y', *inputs,
    '-filter_complex_threads', '1', '-filter_complex', ';'.join(filters),
    '-map', '[out]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21',
    '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', '-t', '20',
    '-threads', '2', '-metadata', 'title=Ronu — Night scenes',
    '-metadata', 'comment=Illustrated stills joined by slow camera movement and dissolves.',
    str(assets / 'night-scenes.mp4'),
], check=True)
print('Encoded three WebP images and night-scenes.mp4.')
