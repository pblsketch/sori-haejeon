# 음원 출처와 라이선스

이 폴더의 음원 8개는 모두 자유 이용 라이선스(CC BY 4.0 또는 CC0)이며, 선생님이 후보를 듣고 고른 것이다.
원본은 저장소에 넣지 않았고(`assets/raw/audio/`, git 제외), 아래처럼 다듬은 결과만 넣었다.

공통으로 손본 것:
- 16 kHz 위 성분을 걸러 냈다(들리지 않는 고주파가 음량 측정을 흐리지 않게, mp3 인코더도 어차피 자르는 대역).
- 음량을 EBU R128(LUFS)로 맞췄다. 배경 음악은 약 -18 LUFS, 효과음은 약 -16 LUFS.
- mp3(LAME)로 다시 저장했다. 배경 음악은 44.1 kHz 스테레오, 효과음은 44.1 kHz 모노.

## 게임 안 '만든 사람·출처'에 넣을 표기

```
"Groove Grove" Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0 License
http://creativecommons.org/licenses/by/4.0/

"Cipher" Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0 License
http://creativecommons.org/licenses/by/4.0/

"Echoes Of Home" by Scott Buckley - released under CC-BY 4.0. www.scottbuckley.com.au

효과음: Freesound(freesound.org)의 CC0 음원 — DRFX, Kreastricon62, qubodup, Saltbearer, craigsmith
```

## 배경 음악

| 파일 | 곡 | 만든 사람 | 출처 | 라이선스 | 손본 것 |
|---|---|---|---|---|---|
| `bgm-practice.mp3` | Groove Grove | Kevin MacLeod | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1200054 (원본 `Groove Grove.mp3`) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 원곡 6.815–171.386초 구간(70 bpm 48마디, 164.6초)을 반복 구간으로 잘랐다. 구간 끝 다음 0.86초를 구간 처음 0.86초에 겹쳐 섞어(상관 보정 등전력 크로스페이드) 끝→처음이 원곡처럼 이어지게 했다. -4.8 dB, 128 kbps. |
| `bgm-duel.mp3` | Cipher | Kevin MacLeod | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100844 (원본 `Cipher2.mp3`) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 원곡 16.688–208.701초 구간(150 bpm 120마디, 192.0초)을 반복 구간으로 잘랐고, 0.8초 크로스페이드로 이음새를 이었다. 원본에 있던 약 21.8 kHz의 들리지 않는 음을 걸러 냈다. +1.0 dB, 128 kbps. |
| `bgm-result.mp3` | Echoes Of Home | Scott Buckley | https://www.scottbuckley.com.au/library/echoes-of-home/ (원본 `EchoesOfHome.mp3`) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 원곡 55.537–122.392초 구간(66.9초)을 잘라 1.0초 크로스페이드로 반복되게 이었다. -1.6 dB, 160 kbps. |

반복 구간은 스펙트럼·화성(크로마)이 가장 닮은 두 지점을 찾아 정했고, 크로스페이드 위치는 파형 상관으로 샘플 단위까지 맞췄다.

## 효과음

모두 Freesound의 CC0 음원이다(출처 표기 의무는 없지만 적어 둔다). 원본 대신 Freesound가 공개한 고음질 미리듣기 mp3를 받아 썼다.

| 파일 | 원래 이름 | 만든 사람 | 출처 | 라이선스 | 손본 것 |
|---|---|---|---|---|---|
| `sfx-fire.mp3` | Background Cannon Shot | DRFX | https://freesound.org/people/DRFX/sounds/404166/ | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 1.00초부터 1.20초 길이로 자름, 끝 0.4초 페이드아웃, -3.6 dB |
| `sfx-hit.mp3` | Fiery Explosion.wav | Kreastricon62 | https://freesound.org/people/Kreastricon62/sounds/239569/ | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 폭발 직전 0.38초부터 1.95초 길이로 자름(폭발 + 불 타는 꼬리), 끝 0.7초 페이드아웃, -9.6 dB |
| `sfx-miss.mp3` | Big Water Splash | qubodup | https://freesound.org/people/qubodup/sounds/442773/ | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 처음부터 1.45초 길이로 자름, 끝 0.45초 페이드아웃, -2.9 dB와 최댓값 -1.5 dBFS 리미터 |
| `sfx-dud.mp3` | fizzlehiss.wav | Saltbearer | https://freesound.org/people/Saltbearer/sounds/508759/ | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 처음부터 1.15초 길이로 자름, 끝 0.5초 페이드아웃, +1.3 dB |
| `sfx-sunk.mp3` | G22-30-Titanic Sinks.wav | craigsmith | https://freesound.org/people/craigsmith/sounds/438293/ | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 처음 3.4초(부서지는 소리와 물거품)만 자름, 끝 0.6초 페이드아웃, +3.8 dB |

## 점검

`node tests/check-audio.mjs`(또는 `cd tests && npm test -- audio`): 파일 8개가 있고 풀리는지, 효과음 길이, 배경 음악 반복 이음새(끝·처음 20 ms의 소리 크기 차와 한 샘플 튐), 배경 음악끼리 음량 차, 효과음 클리핑을 잰다. ffmpeg가 필요하다.
