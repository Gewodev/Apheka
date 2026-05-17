import { apiFetch } from './index';

interface Course {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
  description?: string;
  enrollmentCode?: string;
  courseState: 'ACTIVE' | 'ARCHIVED' | 'PROVISIONED';
  teacherGroupEmail?: string;
  courseGroupEmail?: string;
}

interface CoursesResponse {
  courses: Course[];
}

interface CourseWork {
  courseId: string;
  id: string;
  title: string;
  description?: string;
  state: 'PUBLISHED' | 'DRAFT' | 'DELETED';
  alternateLink?: string;
  creationTime: string;
  dueDate?: { year: number; month: number; day: number };
  dueTime?: { hours: number; minutes: number };
  maxPoints?: number;
}

interface CourseWorkResponse {
  courseWork: CourseWork[];
}

interface Submission {
  id: string;
  courseWorkId: string;
  state: 'CREATED' | 'TURNED_IN' | 'RETURNED' | 'RECLAIMED_BY_STUDENT';
  alternateLink?: string;
  assignedGrade?: number;
}

interface SubmissionsResponse {
  studentSubmissions: Submission[];
}

export async function listCourses(): Promise<Course[]> {
  try {
    const res = await apiFetch<CoursesResponse>(
      '/v1/courses?courseStates=ACTIVE',
    );
    return res.courses || [];
  } catch {
    return [];
  }
}

export async function getCourseWork(courseId: string): Promise<CourseWork[]> {
  try {
    const res = await apiFetch<CourseWorkResponse>(
      `/v1/courses/${courseId}/courseWork`,
    );
    return res.courseWork || [];
  } catch {
    return [];
  }
}

export async function getSubmissions(courseId: string, courseWorkId: string): Promise<Submission[]> {
  try {
    const res = await apiFetch<SubmissionsResponse>(
      `/v1/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions`,
    );
    return res.studentSubmissions || [];
  } catch {
    return [];
  }
}

export async function importClassroomCourses(): Promise<{
  courses: { id: string; name: string; section?: string; description?: string; color?: string }[];
}> {
  const courses = await listCourses();
  const colors = ['#E11D48', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];
  return {
    courses: courses.map((c, i) => ({
      id: c.id,
      name: c.name,
      section: c.section,
      description: c.descriptionHeading || c.description,
      color: colors[i % colors.length],
    })),
  };
}

export async function importClassroomAssignments(courseId: string): Promise<{
  assignments: { title: string; description?: string; dueDate?: string; url?: string }[];
}> {
  const work = await getCourseWork(courseId);
  return {
    assignments: work
      .filter(w => w.state === 'PUBLISHED')
      .map(w => ({
        title: w.title,
        description: w.description,
        dueDate: w.dueDate
          ? `${w.dueDate.year}-${String(w.dueDate.month).padStart(2, '0')}-${String(w.dueDate.day).padStart(2, '0')}`
          : undefined,
        url: w.alternateLink,
      })),
  };
}
