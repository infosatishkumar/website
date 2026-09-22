export type Project = {
  id: string;
  title: string;
  slug: string;
  description: string;
  content: string | null;
  image_url: string | null;
  tags: string[];
  project_url: string | null;
  repo_url: string | null;
  featured: boolean;
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};
