/* eslint-disable @typescript-eslint/no-explicit-any */

export interface TemplateModel {
  _id: string;
  name: string;
  templateName: string;
  template: string;
}

const DEFAULT_API_BASE_URL = 'https://api.hivesuite.app/data/templates';

const headers = (token: string) => ({
  'Authorization': token,
  'Content-Type': 'application/json',
});

export const templateService = {
  async getTemplates(token: string, apiBaseUrl?: string): Promise<TemplateModel[]> {
    const url = apiBaseUrl || DEFAULT_API_BASE_URL;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: headers(token),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData?.error === "TokenExpiredError: jwt expired") {
          throw new Error("JWT_EXPIRED");
        }
        console.warn(`Failed to fetch templates: ${response.status} ${response.statusText}`);
        return [];
      }

      const templates = await response.json();
      if (!Array.isArray(templates)) return [];
      return templates.map((t: any) => ({
        _id: t._id,
        name: t.name,
        templateName: t.templateName,
        template: t.template,
      }));
    } catch (err: any) {
      if (err?.message === "JWT_EXPIRED") throw err;
      console.warn("Failed to fetch templates:", err);
      return [];
    }
  },

  async createTemplate(token: string, templateName: string, template: string, apiBaseUrl?: string): Promise<TemplateModel> {
    const url = apiBaseUrl || DEFAULT_API_BASE_URL;
    const response = await fetch(url, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ templateName, template }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.error === "TokenExpiredError: jwt expired") throw new Error("JWT_EXPIRED");
      throw new Error(`Failed to create template: ${response.status}`);
    }

    const t = await response.json();
    return { _id: t._id, name: t.name, templateName: t.templateName, template: t.template };
  },

  async updateTemplate(token: string, id: string, templateName: string, template: string, apiBaseUrl?: string): Promise<TemplateModel> {
    const url = apiBaseUrl || DEFAULT_API_BASE_URL;
    const response = await fetch(url, {
      method: 'PUT',
      headers: headers(token),
      body: JSON.stringify({ id, templateName, template }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.error === "TokenExpiredError: jwt expired") throw new Error("JWT_EXPIRED");
      throw new Error(`Failed to update template: ${response.status}`);
    }

    const t = await response.json();
    return { _id: t._id, name: t.name, templateName: t.templateName, template: t.template };
  },

  async deleteTemplate(token: string, id: string, apiBaseUrl?: string): Promise<void> {
    const url = apiBaseUrl || DEFAULT_API_BASE_URL;
    const response = await fetch(`${url}/${id}`, {
      method: 'DELETE',
      headers: headers(token),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.error === "TokenExpiredError: jwt expired") throw new Error("JWT_EXPIRED");
      throw new Error(`Failed to delete template: ${response.status}`);
    }
  },
};
