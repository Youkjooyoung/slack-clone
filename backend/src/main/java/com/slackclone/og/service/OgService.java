package com.slackclone.og.service;

import com.slackclone.og.dto.OgMetaResponse;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Service;

@Service
public class OgService {

    private static final int TIMEOUT_MS = 5_000;
    private static final String USER_AGENT =
            "Mozilla/5.0 (compatible; SlackCloneBot/1.0; +https://github.com/slackclone)";

    public OgMetaResponse fetchOgMeta(String url) {
        try {
            Document doc = Jsoup.connect(url)
                    .userAgent(USER_AGENT)
                    .timeout(TIMEOUT_MS)
                    .followRedirects(true)
                    .ignoreHttpErrors(true)
                    .get();

            String title = metaContent(doc, "og:title");
            if (title == null || title.isBlank()) {
                title = doc.title();
            }

            String description = metaContent(doc, "og:description");
            if (description == null || description.isBlank()) {
                description = metaContent(doc, "description");
            }

            String imageUrl = metaContent(doc, "og:image");

            // 제목도 없으면 미리보기 불필요
            if (title == null || title.isBlank()) {
                return null;
            }

            return new OgMetaResponse(title.trim(),
                    description != null ? description.trim() : null,
                    imageUrl,
                    url);

        } catch (Exception e) {
            return null;
        }
    }

    /** og: 속성 또는 일반 name 속성 meta 태그에서 content 추출 */
    private String metaContent(Document doc, String property) {
        Element el = doc.selectFirst("meta[property=" + property + "]");
        if (el == null) {
            el = doc.selectFirst("meta[name=" + property + "]");
        }
        if (el == null) return null;
        String content = el.attr("content");
        return content.isBlank() ? null : content;
    }
}
