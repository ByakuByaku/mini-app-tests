export type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';

/** Вариант ответа для студента — без isCorrect */
export interface AnswerOptionDto {
  id: string;
  text: string;
  orderNum: number;
}

export interface QuestionDto {
  id: string;
  type: QuestionType;
  orderNum: number;
  options: AnswerOptionDto[];
}

/** Краткая карточка теста в списке */
export interface TestListItemDto {
  id: string;
  title: string;
  description: string | null;
  timeLimitSec: number | null;
  questionCount: number;
}

/** Полный тест для прохождения студентом */
export interface TestDetailDto {
  id: string;
  title: string;
  description: string | null;
  timeLimitSec: number | null;
  questions: QuestionDto[];
}

/** Вариант ответа в админке — с признаком правильности */
export interface AdminAnswerOptionDto extends AnswerOptionDto {
  isCorrect: boolean;
}

export interface AdminQuestionDto {
  id: string;
  type: QuestionType;
  orderNum: number;
  options: AdminAnswerOptionDto[];
}

export interface AdminTestListItemDto {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  timeLimitSec: number | null;
  questionCount: number;
  createdAt: string;
}

export interface AdminTestDetailDto {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  timeLimitSec: number | null;
  createdAt: string;
  questions: AdminQuestionDto[];
}

export interface CreateAnswerOptionInput {
  text: string;
  isCorrect: boolean;
  orderNum: number;
}

export interface CreateQuestionInput {
  type: QuestionType;
  orderNum: number;
  options: CreateAnswerOptionInput[];
}

export interface CreateTestInput {
  title: string;
  description?: string | null;
  isActive?: boolean;
  timeLimitSec?: number | null;
  questions: CreateQuestionInput[];
}

export interface UpdateTestInput {
  title?: string;
  description?: string | null;
  isActive?: boolean;
  timeLimitSec?: number | null;
  questions?: CreateQuestionInput[];
}
