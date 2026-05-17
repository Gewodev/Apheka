import { apiFetch } from './index';

interface FormResponse {
  formId: string;
  responderUri: string;
}

interface FormItem {
  title: string;
  questionItem: {
    question: {
      choiceQuestion?: {
        type: 'RADIO' | 'CHECKBOX' | 'DROP_DOWN';
        options: { value: string }[];
      };
      textQuestion?: {
        paragraph: boolean;
      };
    };
  };
}

type QuizQuestion = { question: string; type: 'text' | 'multiple' | 'checkbox'; options?: string[] };

export async function createQuiz(
  title: string,
  questions: QuizQuestion[],
): Promise<{ formId: string; url: string } | null> {
  try {
    const form = await apiFetch<FormResponse>('/forms/v1/forms', {
      method: 'POST',
      body: JSON.stringify({
        info: { title, documentTitle: title },
        items: questions.map((q): FormItem => {
          if (q.type === 'text') {
            return {
              title: q.question,
              questionItem: {
                question: { textQuestion: { paragraph: false } },
              },
            };
          }
          return {
            title: q.question,
            questionItem: {
              question: {
                choiceQuestion: {
                  type: q.type === 'checkbox' ? 'CHECKBOX' : 'RADIO',
                  options: (q.options || []).map(o => ({ value: o })),
                },
              },
            },
          };
        }),
      }),
    });
    return {
      formId: form.formId,
      url: form.responderUri,
    };
  } catch { return null; }
}

export async function createStudyQuiz(courseName: string, topics: string[]): Promise<string | null> {
  const questions: QuizQuestion[] = topics.map(topic => ({
    question: `¿Qué aprendiste sobre ${topic}?`,
    type: 'text',
  }));

  questions.push({
    question: '¿Qué tan difícil fue este tema?',
    type: 'multiple',
    options: ['Muy fácil', 'Fácil', 'Normal', 'Difícil', 'Muy difícil'],
  });

  const result = await createQuiz(`Quiz - ${courseName}`, questions);
  return result?.url || null;
}
