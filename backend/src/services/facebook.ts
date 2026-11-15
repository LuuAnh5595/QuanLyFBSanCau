export interface FacebookPublishResult {
  id: string;
  postUrl: string;
}

export class FacebookService {
  private pageId: string;
  private accessToken: string;
  private apiVersion: string = 'v20.0';

  constructor(pageId: string, accessToken: string) {
    this.pageId = pageId;
    this.accessToken = accessToken;
  }

  async publishPost(options: {
    content: string;
    mediaUrls?: string[];
  }): Promise<FacebookPublishResult> {
    if (!this.pageId || !this.accessToken) {
      throw new Error('Chưa cấu hình Facebook Page ID hoặc Page Access Token.');
    }

    const { content, mediaUrls = [] } = options;
    const validMediaUrls = mediaUrls.filter(url => url && (url.startsWith('http://') || url.startsWith('https://')));

    // Case 1: Post with 1 Photo
    if (validMediaUrls.length === 1) {
      return await this.publishSinglePhoto(content, validMediaUrls[0]);
    }

    // Case 2: Post with Multi Photos (>= 2)
    if (validMediaUrls.length > 1) {
      return await this.publishMultiPhotos(content, validMediaUrls);
    }

    // Case 3: Text-only post
    return await this.publishTextOnly(content);
  }

  private async publishTextOnly(content: string): Promise<FacebookPublishResult> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.pageId}/feed`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: content,
        access_token: this.accessToken
      })
    });

    const data: any = await response.json();
    if (!response.ok || data.error) {
      this.handleGraphError(data.error || response.statusText);
    }

    const postId = data.id;
    return {
      id: postId,
      postUrl: `https://facebook.com/${postId}`
    };
  }

  private async publishSinglePhoto(content: string, photoUrl: string): Promise<FacebookPublishResult> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.pageId}/photos`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: photoUrl,
        caption: content,
        access_token: this.accessToken
      })
    });

    const data: any = await response.json();
    if (!response.ok || data.error) {
      this.handleGraphError(data.error || response.statusText);
    }

    // data.post_id is the feed post ID for the photo; data.id is the photo ID
    const postId = data.post_id || data.id;
    return {
      id: postId,
      postUrl: `https://facebook.com/${postId}`
    };
  }

  private async publishMultiPhotos(content: string, photoUrls: string[]): Promise<FacebookPublishResult> {
    // Step 1: Upload each photo as unpublished
    const uploadedMediaIds: string[] = [];

    for (const photoUrl of photoUrls) {
      const uploadUrl = `https://graph.facebook.com/${this.apiVersion}/${this.pageId}/photos`;
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: photoUrl,
          published: false,
          access_token: this.accessToken
        })
      });

      const uploadData: any = await uploadRes.json();
      if (uploadRes.ok && uploadData.id) {
        uploadedMediaIds.push(uploadData.id);
      }
    }

    if (uploadedMediaIds.length === 0) {
      // Fallback to text-only if all image uploads fail
      return await this.publishTextOnly(content);
    }

    // Step 2: Publish feed post with attached media
    const feedUrl = `https://graph.facebook.com/${this.apiVersion}/${this.pageId}/feed`;
    const attachedMedia = uploadedMediaIds.map(media_fbid => ({ media_fbid }));

    const response = await fetch(feedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: content,
        attached_media: attachedMedia,
        access_token: this.accessToken
      })
    });

    const data: any = await response.json();
    if (!response.ok || data.error) {
      this.handleGraphError(data.error || response.statusText);
    }

    const postId = data.id;
    return {
      id: postId,
      postUrl: `https://facebook.com/${postId}`
    };
  }

  private handleGraphError(error: any): never {
    const code = error?.code;
    const msg = error?.message || String(error);

    if (code === 190) {
      throw new Error(`[Lỗi Facebook Graph API] Token của Fanpage đã hết hạn hoặc bị hủy (Code 190). Vui lòng cập nhật Token mới trong trang Cài đặt.`);
    }
    if (code === 200) {
      throw new Error(`[Lỗi Facebook Graph API] Không đủ quyền đăng bài lên Fanpage (Code 200). Đảm bảo Token có quyền 'pages_manage_posts' và 'pages_read_engagement'.`);
    }

    throw new Error(`[Lỗi Facebook Graph API]: ${msg} (Mã lỗi: ${code || 'N/A'})`);
  }
}
