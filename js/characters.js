// 고를 수 있는 캐릭터 그림 (16×24 도트, 오른쪽을 봄). 선생님 요청으로 치이카와 친구들 — 교육용·비영리 전용.
// 캐릭터를 바꾸려면 이 파일만 고치면 된다. 다리(4줄)는 sprites.js가 공통으로 붙인다.
//   ears: [기본, 귀 움찔] 4줄씩 / head 12줄 / body 4줄 / bodyUp 4줄(떨어질 때 팔 든 모습)
//   팔레트: k 테두리, w 털, W 털 그림자, e 눈, c 볼, m 입, p·P·o 다리·그림자·발 (+ 캐릭터마다 n·f·i)
window.SF = window.SF || {};
(function (SF) {
  'use strict';

  const BASE = { k: '#3b3134', e: '#1d1719', c: '#ffaebb', m: '#c9505e' };
  const pal = (o) => Object.assign({}, BASE, o);

  // 둥근 얼굴 (치이카와·우사기): 눈은 오른쪽으로 한 칸 치우쳐 보는 방향이 느껴지게
  const ROUND_HEAD = [
    '...kwwwwwwwwk...',
    '..kwwwwwwwwwwk..',
    '.kwwwwwwwwwwwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwwwewwwwewwk.',
    '.kwwwwewwwwewwk.',
    '.kwwccwwmmwwcck.',
    '.kwwwwwwwwwwwwk.',
    '.kwwwwwwwwwwwwk.',
    '..kwwwwwwwwwwk..',
    '...kwwwwwwwwk...',
    '....kkkkkkkk....',
  ];
  // 동글동글한 배
  const BODY = [
    '...kwwwwwwwwk...',
    '..kwwwwwwwwwwk..',
    '..kwwwwwwwwwwk..',
    '...kWwwwwwwWk...',
  ];
  const BODY_UP = [
    '.wkwwwwwwwwwwkw.',
    '..kwwwwwwwwwwk..',
    '..kwwwwwwwwwwk..',
    '...kWwwwwwwWk...',
  ];
  // 짧고 통통한 다리 (4줄) — 서기·걷기 2자세·지나가기·오르기·떨어지기, 착지는 3줄
  const LEGS = {
    stand: ['...kppppppppk...', '...kppk..kppk...', '...kPPk..kPPk...', '....kk....kk....'],
    strideA: ['...kppppppppk...', '..kppk....kppk..', '..kPPk....kPPk..', '...kk......kk...'],
    strideB: ['...kppppppppk...', '..kPPk....kppk..', '..kppk....kPPk..', '...kk......kk...'],
    pass: ['...kppppppppk...', '....kppkkppk....', '....kPPkkPPk....', '.....kk..kk.....'],
    step: ['...kppppppppk...', '...kppk.kpppk...', '...kPPk..kkk....', '....kk..........'],
    fall: ['...kppppppppk...', '..kppk....kppk..', '..kkk......kkk..', '................'],
  };
  const CROUCH = ['..kppppppppppk..', '..kPPk....kPPk..', '...kk......kk...'];
  const WHITE = { w: '#ffffff', W: '#e4dcdc', p: '#ffffff', P: '#e4dcdc', o: '#c9bfbf' };

  const CHUBBY = { legs: LEGS, crouch: CROUCH };

  SF.CHARACTERS = [
    {
      id: 'chiikawa', name: '치이카와',
      pal: pal(WHITE),
      ears: [
        ['................', '................', '...kkk....kkk...', '..kwwwk..kwwwk..'],
        ['................', '...kkk....kkk...', '..kwwwk..kwwwk..', '..kwwwk..kwwwk..'],
      ],
      head: ROUND_HEAD, body: BODY, bodyUp: BODY_UP,
    },
    {
      id: 'hachiware', name: '하치와레',
      pal: pal(Object.assign({ n: '#5d7fc4' }, WHITE)),
      ears: [
        ['................', '..kk........kk..', '..knk......knk..', '..knnk....knnk..'],
        ['................', '................', '..kk........kk..', '..knnk....knnk..'],
      ],
      // 이마 가운데가 흰색으로 갈라지는 무늬
      head: [
        '...knnnwwnnnk...',
        '..knnnnwwnnnnk..',
        '.knnnnwwwwnnnnk.',
        '.knnnwwwwwwnnnk.',
        '.knnwwewwwwewnk.',
        '.knwwwewwwwewwk.',
        '.kwwccwwmmwwcck.',
        '.kwwwwwwwwwwwwk.',
        '.kwwwwwwwwwwwwk.',
        '..kwwwwwwwwwwk..',
        '...kwwwwwwwwk...',
        '....kkkkkkkk....',
      ],
      body: BODY, bodyUp: BODY_UP,
    },
    {
      id: 'usagi', name: '우사기',
      pal: pal({ w: '#fff0a3', W: '#e6cd6a', i: '#ffb7c4', p: '#fff0a3', P: '#e6cd6a', o: '#cfb55a' }),
      // 긴 귀 (움찔할 때 오른쪽 귀 끝이 접힘)
      ears: [
        ['....kk....kk....', '...kwik..kiwk...', '...kwik..kiwk...', '...kwik..kiwk...'],
        ['................', '....kk....kkk...', '...kwik..kiwwk..', '...kwik..kiwk...'],
      ],
      // 크게 벌린 입
      head: ROUND_HEAD.slice(0, 7).concat(['.kwwwwwwmmwwwwk.'], ROUND_HEAD.slice(8)),
      body: BODY, bodyUp: BODY_UP,
    },
    {
      id: 'rakko', name: '랏코',
      pal: pal({ w: '#b98258', W: '#8d5d3c', f: '#f7e6ca', n: '#4a2c1e', p: '#b98258', P: '#8d5d3c', o: '#6e4630' }),
      ears: [
        ['................', '................', '...kk......kk...', '..kwwk....kwwk..'],
        ['................', '...kk......kk...', '..kwwk....kwwk..', '..kwwk....kwwk..'],
      ],
      // 갈색 머리에 밝은 얼굴, 코
      head: [
        '...kwwwwwwwwk...',
        '..kwwwwwwwwwwk..',
        '.kwwwwwwwwwwwwk.',
        '.kwwwwffffffwwk.',
        '.kwwwfeffffefwk.',
        '.kwwwfeffffefwk.',
        '.kwwffffnnfffwk.',
        '.kwwfffmffmffwk.',
        '.kwwwffffffffwk.',
        '..kwwwwwwwwwwk..',
        '...kwwwwwwwwk...',
        '....kkkkkkkk....',
      ],
      // 밝은 배
      body: ['...kwwwwwwwwk...', '..kwwwffffwwwk..', '..kwwwffffwwwk..', '...kWwwwwwwWk...'],
      bodyUp: ['.wkwwwwwwwwwwkw.', '..kwwwffffwwwk..', '..kwwwffffwwwk..', '...kWwwwwwwWk...'],
    },
  ];
  for (const c of SF.CHARACTERS) Object.assign(c, CHUBBY);
})(window.SF);
