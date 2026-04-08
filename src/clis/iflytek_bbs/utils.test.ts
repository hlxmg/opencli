import { describe, expect, it } from 'vitest';

import {
  extractIflytekBbsBoardsFromHtml,
  extractIflytekBbsTopicDetailFromHtml,
  extractIflytekBbsTopicsFromHtml,
} from './utils.js';

describe('extractIflytekBbsBoardsFromHtml', () => {
  it('extracts visible boards with names and links', () => {
    const html = `
      <div class="forum-board">
        <a href="/fornt/forum/board/1">钻石社区</a>
        <p>经验交流</p>
      </div>
      <div class="forum-board">
        <a href="/fornt/forum/board/2">技术论坛</a>
        <p>技术讨论</p>
      </div>
    `;

    expect(extractIflytekBbsBoardsFromHtml(html, 'https://in.iflytek.com')).toEqual([
      { Board: '钻石社区', Description: '经验交流', URL: 'https://in.iflytek.com/fornt/forum/board/1' },
      { Board: '技术论坛', Description: '技术讨论', URL: 'https://in.iflytek.com/fornt/forum/board/2' },
    ]);
  });
});

describe('extractIflytekBbsTopicsFromHtml', () => {
  it('extracts topic rows from a board list', () => {
    const html = `
      <div class="topic-row">
        <a class="topic-title" href="/fornt/forum/topic/101">报账流程经验分享</a>
        <span class="author">李帅</span>
        <span class="replies">12</span>
        <span class="views">88</span>
        <span class="updated">2026-04-03 10:00</span>
      </div>
    `;

    expect(extractIflytekBbsTopicsFromHtml(html, 'https://in.iflytek.com')).toEqual([
      {
        Title: '报账流程经验分享',
        Author: '李帅',
        Replies: '12',
        Views: '88',
        UpdatedAt: '2026-04-03 10:00',
        URL: 'https://in.iflytek.com/fornt/forum/topic/101',
      },
    ]);
  });

  it('extracts actual crackling list rows from the forum board page', () => {
    const html = `
      <ul class="crackling-ul clearfix">
        <li>
          <div class="title">
            <a href="/iflyteksns/forum/web/snsDoc/detail/166963">【AI实战派】忙到“爆炸”，我给自己“手搓”了一个“工具人”</a>
            <h4 style="top:0"><span class="span1" title="置顶"></span></h4>
          </div>
          <div class="conte clearfix">
            <span class="tag">官方活动</span>
            <span class="normal">钻石社区管理员</span>
            <span class="normal prev-line">发表时间：2026-04-01</span>
            <span class="normal prev-line">最后回复：2026-04-01 13:59</span>
            <span class="operate fr">
              <em><i class="iconfont iconliulan"></i>126</em>
              <em onclick="toComment(166963)"><i class="iconfont iconpinglun"></i>0</em>
              <em onclick="addDiggs(166963,1)"><i class="iconfont icondianzan"></i><label id="digg_label_166963">0</label></em>
            </span>
          </div>
        </li>
      </ul>
    `;

    expect(extractIflytekBbsTopicsFromHtml(html, 'https://in.iflytek.com')).toEqual([
      {
        Title: '【AI实战派】忙到“爆炸”，我给自己“手搓”了一个“工具人”',
        Author: '钻石社区管理员',
        Replies: '0',
        Views: '126',
        UpdatedAt: '2026-04-01 13:59',
        URL: 'https://in.iflytek.com/iflyteksns/forum/web/snsDoc/detail/166963',
      },
    ]);
  });
});

describe('extractIflytekBbsTopicDetailFromHtml', () => {
  it('extracts topic detail content', () => {
    const html = `
      <article>
        <h1>报账流程经验分享</h1>
        <div class="meta">
          <span class="author">李帅</span>
          <span class="board">钻石社区</span>
          <span class="published">2026-04-03 10:00</span>
        </div>
        <div class="topic-content"><p>这里是正文</p></div>
      </article>
    `;

    expect(extractIflytekBbsTopicDetailFromHtml(html, 'https://in.iflytek.com/fornt/forum/topic/101')).toEqual({
      Title: '报账流程经验分享',
      Author: '李帅',
      PublishedAt: '2026-04-03 10:00',
      Board: '钻石社区',
      Content: '这里是正文',
      URL: 'https://in.iflytek.com/fornt/forum/topic/101',
    });
  });

  it('extracts actual topic detail metadata and paragraphs', () => {
    const html = `
      <div class="breadcrumb">
        <a class="bread first" href="/iflyteksns/forum/web/special/5">飞er心声</a>
        <a class="bread" href="/iflyteksns/forum/web/snsDoc/detail/164918">停车侠请就位！园区违停最新情况通报&amp;园区停车攻略速览</a>
      </div>
      <div class="header">停车侠请就位！园区违停最新情况通报&amp;园区停车攻略速览 行政中心 11 帖子数 0 积分</div>
      <div class="plate-content">
        <ul class="crackling-ul clearfix">
          <li>
            <div class="title">
              停车侠请就位！园区违停最新情况通报&amp;园区停车攻略速览
              <h4></h4>
            </div>
            <div class="conte clearfix">
              <span class="tag">官方活动</span>
              <span class="normal">发布时间：2025-10-20 11:17</span>
            </div>
          </li>
        </ul>
        <p>各位同事：</p>
        <p>大家好！针对社区内反映的总部园区车辆违停问题，行政中心已高度重视并持续跟进。</p>
        <p>欢迎共同监督。</p>
        <div class="praise-collection clearfix"></div>
      </div>
    `;

    expect(extractIflytekBbsTopicDetailFromHtml(html, 'https://in.iflytek.com/iflyteksns/forum/web/snsDoc/detail/164918')).toEqual({
      Title: '停车侠请就位！园区违停最新情况通报&园区停车攻略速览',
      Author: '行政中心',
      PublishedAt: '2025-10-20 11:17',
      Board: '飞er心声',
      Content: [
        '各位同事：',
        '大家好！针对社区内反映的总部园区车辆违停问题，行政中心已高度重视并持续跟进。',
        '欢迎共同监督。',
      ].join('\n\n'),
      URL: 'https://in.iflytek.com/iflyteksns/forum/web/snsDoc/detail/164918',
    });
  });
});
