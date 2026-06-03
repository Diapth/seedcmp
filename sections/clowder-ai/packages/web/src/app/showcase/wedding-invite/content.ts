export interface WeddingScheduleItem {
  time: string;
  title: string;
  detail: string;
}

export interface WeddingStoryBeat {
  year: string;
  title: string;
  detail: string;
}

export interface WeddingPhotoSlot {
  title: string;
  note: string;
  status: string;
}

export interface WeddingTravelNote {
  title: string;
  detail: string;
}

export interface WeddingInviteContent {
  label: string;
  theme: string;
  overview: string;
  couple: {
    display: string;
    native: string;
    monogram: string;
  };
  event: {
    isoStart: string;
    isoEnd: string;
    timezone: string;
    timeZoneId: string;
    city: string;
    venue: string;
    venueNote: string;
    address: string;
    arrival: string;
    dressCode: string;
    mapUrl: string | null;
  };
  schedule: WeddingScheduleItem[];
  story: WeddingStoryBeat[];
  gallery: WeddingPhotoSlot[];
  travel: WeddingTravelNote[];
  rsvp: {
    deadline: string;
    formUrl: string | null;
    note: string;
  };
  checklist: string[];
}

export const weddingInviteContent: WeddingInviteContent = {
  label: 'Wedding Invite MVP',
  theme: 'Sunset Garden Ceremony',
  overview:
    '一页式婚礼邀请函 MVP，面向手机浏览优先。真实资料未确认的部分全部显式标成待替换，避免把装饰当成真实信息。',
  couple: {
    display: 'Nuo & Chuan',
    native: '许诺 与 林川',
    monogram: 'NC',
  },
  event: {
    isoStart: '2026-10-18T15:30:00+08:00',
    isoEnd: '2026-10-18T21:30:00+08:00',
    timezone: 'GMT+8',
    timeZoneId: 'Asia/Shanghai',
    city: '上海',
    venue: '日落花园宴会厅',
    venueNote: '当前为示例场地名，最终宴会厅与地图链接待新人确认后替换。',
    address: '上海市黄浦区滨江花园会馆 2F（示例地址，待替换为真实导航地址）',
    arrival: '15:00 开始签到，建议 14:40 前到场预留拍照与落座时间。',
    dressCode: 'Garden Formal · 香槟金、奶油白、深墨绿优先',
    mapUrl: null,
  },
  schedule: [
    {
      time: '15:00',
      title: '签到与欢迎饮品',
      detail: '花园入口签到，领取席位卡与拍立得任务卡。',
    },
    {
      time: '16:00',
      title: '草坪仪式',
      detail: '誓词交换、家人致意与集体合影。',
    },
    {
      time: '18:00',
      title: '晚宴开席',
      detail: '入场 toast、第一支舞、晚宴菜单正式开始。',
    },
    {
      time: '20:15',
      title: '露台自由时段',
      detail: '甜品台、祝酒、自由拍照与好友小聚。',
    },
  ],
  story: [
    {
      year: '2021',
      title: '在城市边缘第一次顺路',
      detail: '一杯晚下班后的拿铁，把“再见”聊成了“下次还见”。',
    },
    {
      year: '2023',
      title: '把周末变成共同生活',
      detail: '从共享歌单、共享钥匙，到开始认真讨论想一起走到哪里。',
    },
    {
      year: '2026',
      title: '决定把亲密关系公开成誓言',
      detail: '这场婚礼想做得像我们本人一样：温柔、清晰、没有多余表演。',
    },
  ],
  gallery: [
    {
      title: '主视觉照片',
      note: '建议替换为竖版双人照，首屏观感会更完整。',
      status: '待替换',
    },
    {
      title: '订婚或领证瞬间',
      note: '适合放在故事区旁边，增强时间线真实感。',
      status: '待替换',
    },
    {
      title: '朋友视角生活照',
      note: '优先选自然场景，避免全部是棚拍素材。',
      status: '待替换',
    },
    {
      title: '家庭合影',
      note: '可在晚宴前夕更新，补足亲友参与感。',
      status: '待替换',
    },
  ],
  travel: [
    {
      title: '交通',
      detail: '建议在真实地址确认后补充地铁站、停车场入口与步行时间。',
    },
    {
      title: '住宿',
      detail: '如果有外地宾客，可加两家附近酒店与协议价说明。',
    },
    {
      title: '天气',
      detail: '花园婚礼建议婚礼前 7 天补充天气与备选室内方案。',
    },
  ],
  rsvp: {
    deadline: '2026-09-20',
    formUrl: null,
    note: '当前未接入表单。推荐接飞书表单或 Google Form，并同步饮食禁忌与同行人数字段。',
  },
  checklist: [
    '替换新人姓名、日期、城市、场地与真实地址',
    '补一张首屏主视觉照片与 3 到 4 张故事/相册照片',
    '接入地图链接与 RSVP 表单链接',
    '按真实宾客需求补充交通、住宿、着装与儿童席位说明',
  ],
};
