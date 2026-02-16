// Production: относительный /api (same origin, без CORS). Dev: из .env
const API_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL || 'http://localhost:3001/api')
  : '/api';

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs = 10000
  ): Promise<T> {
    const token = this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const { signal: _skip, ...restOptions } = options;

    try {
      var response = await fetch(`${API_URL}${endpoint}`, {
        ...restOptions,
        headers,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      // Handle 401 Unauthorized - clear token and redirect to login
      if (response.status === 401) {
        localStorage.removeItem('auth_token');
        // Redirect to login if not already there
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        throw new Error('Не авторизован. Пожалуйста, войдите снова.');
      }
      
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // If response is not JSON, try to get text
        try {
          const text = await response.text();
          if (text) errorMessage = text.substring(0, 200);
        } catch {
          // Keep default error message
        }
      }
      
      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return undefined as T;
    }
    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('application/json')) {
      return undefined as T;
    }
    return response.json();
  }

  // Auth
  async login(login: string, password: string) {
    const data = await this.request<{ access_token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    });
    if (data.access_token) {
      localStorage.setItem('auth_token', data.access_token);
    }
    return data;
  }

  async getMe() {
    return this.request<any>('/auth/me');
  }

  async logout() {
    localStorage.removeItem('auth_token');
    return this.request('/auth/logout', { method: 'POST' });
  }

  // Users
  async getUsers() {
    return this.request<{ users: any[] }>('/users');
  }

  async createUser(data: { login: string; password: string; full_name?: string; role?: string }) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(userId: string, data: { login?: string; password?: string; full_name?: string }) {
    return this.request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(userId: string) {
    return this.request(`/users/${userId}`, {
      method: 'DELETE',
    });
  }

  // Projects
  async getProjects() {
    return this.request<{ projects: any[] }>('/projects');
  }

  async getProject(projectId: string) {
    return this.request<any>(`/projects/${projectId}`);
  }

  async createProject(data: { name: string; description?: string }) {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(projectId: string, data: { name?: string; description?: string; has_gck?: boolean }) {
    return this.request(`/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(projectId: string) {
    return this.request(`/projects/${projectId}`, {
      method: 'DELETE',
    });
  }

  async getProjectStats() {
    return this.request<{ stats: Record<string, { uniqueCalls: number; convCall: string; convLead: string }> }>('/projects/stats');
  }

  async getProjectDashboardStats(projectId: string, params?: { fromDate?: string; toDate?: string }) {
    const query = new URLSearchParams();
    if (params?.fromDate) query.append('fromDate', params.fromDate);
    if (params?.toDate) query.append('toDate', params.toDate);
    const qs = query.toString();
    return this.request<{ uniqueCalls: number; answered: number; leads: number; answerRate: number }>(
      `/projects/${projectId}/stats${qs ? `?${qs}` : ''}`
    );
  }

  // Calls
  async getCalls(projectId: string, params?: { page?: number; pageSize?: number; status?: string; phone?: string; isGck?: boolean }) {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString());
    if (params?.status) query.append('status', params.status);
    if (params?.phone) query.append('phone', params.phone);
    if (params?.isGck === true) query.append('isGck', 'true');
    else if (params?.isGck === false) query.append('isGck', 'false');
    const queryString = query.toString();
    return this.request<{ calls: any[]; total: number; page: number; pageSize: number }>(
      `/calls/project/${projectId}${queryString ? `?${queryString}` : ''}`
    );
  }

  async deleteCalls(callIds: string[]) {
    return this.request('/calls/batch', {
      method: 'DELETE',
      body: JSON.stringify({ callIds }),
    });
  }

  // Suppliers
  async getSuppliers(projectId: string, params?: { isGck?: boolean }) {
    const query = new URLSearchParams();
    if (params?.isGck === true) query.append('isGck', 'true');
    else if (params?.isGck === false) query.append('isGck', 'false');
    const queryString = query.toString();
    return this.request<{ suppliers: any[] }>(
      `/suppliers/project/${projectId}${queryString ? `?${queryString}` : ''}`
    );
  }

  async createSupplier(data: { project_id: string; name: string; tag?: string; price_per_contact?: number; is_gck?: boolean }) {
    return this.request('/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSupplier(supplierId: string, data: { name?: string; tag?: string; price_per_contact?: number; is_gck?: boolean }) {
    return this.request(`/suppliers/${supplierId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSupplier(supplierId: string) {
    return this.request(`/suppliers/${supplierId}`, {
      method: 'DELETE',
    });
  }

  // Imports
  async getImports(projectId: string) {
    return this.request<{ imports: any[] }>(`/imports/project/${projectId}`);
  }

  async deleteImport(importId: string) {
    return this.request(`/imports/${importId}`, { method: 'DELETE' });
  }

  async importCsv(data: {
    project_id: string;
    type: 'suppliers' | 'calls';
    rows: Record<string, string>[];
    filename: string;
    supplier_id?: string;
    is_gck?: boolean;
  }) {
    return this.request<{ total: number; inserted: number; skipped: number; errors: number }>('/import-csv', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Project Pricing
  async getProjectPricing(projectId: string) {
    return this.request<any>(`/projects/${projectId}/pricing`);
  }

  async updateProjectPricing(projectId: string, data: { price_per_number?: number; price_per_call?: number; price_per_minute?: number }) {
    return this.request(`/projects/${projectId}/pricing`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Project Members
  async getProjectMembers(projectId: string) {
    return this.request<{ members: any[] }>(`/projects/${projectId}/members`);
  }

  async addProjectMember(projectId: string, data: { userId: string; allowedTabs?: string[] }) {
    return this.request(`/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async removeProjectMember(projectId: string, membershipId: string) {
    return this.request(`/projects/${projectId}/members/${membershipId}`, {
      method: 'DELETE',
    });
  }

  async updateProjectMember(projectId: string, membershipId: string, data: { allowedTabs?: string[] }) {
    return this.request(`/projects/${projectId}/members/${membershipId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Project Status (will need backend endpoint)
  async getProjectStatus(projectId: string) {
    return this.request<any>(`/projects/${projectId}/status`);
  }

  async updateProjectStatus(projectId: string, data: Record<string, any>) {
    return this.request(`/projects/${projectId}/status`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Supplier Numbers
  async getSupplierNumbers(projectId: string, params?: { page?: number; pageSize?: number; supplierId?: string; isGck?: boolean }) {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString());
    if (params?.supplierId) query.append('supplierId', params.supplierId);
    if (params?.isGck === true) query.append('isGck', 'true');
    else if (params?.isGck === false) query.append('isGck', 'false');
    const queryString = query.toString();
    return this.request<{ numbers: any[]; total: number; page: number; pageSize: number }>(
      `/suppliers/project/${projectId}/numbers${queryString ? `?${queryString}` : ''}`
    );
  }

  // Reanimation Exports
  async getReanimationExports(projectId: string) {
    return this.request<{ exports: any[] }>(`/reanimation/project/${projectId}/exports`);
  }

  async createReanimationExport(data: {
    project_id: string;
    phone_count: number;
    duration_filter: string;
    filename: string;
    date_from?: string | null;
    date_to?: string | null;
    phone_numbers: string[];
  }) {
    return this.request<{ id: string }>('/reanimation/exports', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getReanimationExportNumbers(exportId: string) {
    return this.request<{ numbers: any[]; total: number }>(`/reanimation/exports/${exportId}/numbers`);
  }

  async getAllReanimationExports() {
    return this.request<{ exports: any[] }>('/reanimation/exports');
  }

  async deleteReanimationExport(exportId: string) {
    return this.request(`/reanimation/exports/${exportId}`, {
      method: 'DELETE',
    });
  }

  // Cleanup orphaned records (admin only)
  async cleanupOrphanedRecords(): Promise<{
    message: string;
    results: {
      calls_updated: number;
      import_jobs_updated: number;
      reanimation_exports_updated: number;
      supplier_numbers_deleted: number;
      project_members_deleted: number;
      user_roles_deleted: number;
      profiles_deleted: number;
      calls_deleted: number;
      suppliers_deleted: number;
      project_pricing_deleted: number;
      project_status_deleted: number;
      import_jobs_deleted: number;
      reanimation_exports_deleted: number;
      reanimation_export_numbers_deleted: number;
    };
    total_cleaned: number;
  }> {
    return this.request('/projects/cleanup/orphaned', {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
