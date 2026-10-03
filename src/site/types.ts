export type CourseTone = 'rose' | 'blue' | 'wine' | 'sage';

export interface BrandContent {
  name: string;
  eyebrow: string;
  headline: [string, string, string];
  intro: string;
  manifesto: string;
}

export interface CourseContent {
  index: string;
  title: string;
  tags: string[];
  image: string;
  alt: string;
  tone: CourseTone;
}

export interface ClubContent {
  index: string;
  title: string;
  summary: string;
}

export interface LandingContent {
  brand: BrandContent;
  courses: CourseContent[];
  club: ClubContent[];
}
