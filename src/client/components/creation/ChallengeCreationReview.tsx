import { Devvit, useState, useForm } from '@devvit/public-api';
import { AnswerSet } from '../../../server/services/answer-set-generator.service.js';
import { BG_PRIMARY } from '../../constants/colors.js';

interface Props {
    answerSet: AnswerSet;
    onConfirm: (finalAnswerSet: AnswerSet) => void;
    onCancel: () => void;
}

export const ChallengeCreationReview: Devvit.BlockComponent<Props> = (
    { answerSet, onConfirm, onCancel },
    context
) => {
    const [correctAnswers, setCorrectAnswers] = useState<string[]>(answerSet.correct);
    const [closeAnswers, setCloseAnswers] = useState<string[]>(answerSet.close);
    const [editingIndex, setEditingIndex] = useState<{ type: 'correct' | 'close', index: number } | null>(null);
    const [correctPage, setCorrectPage] = useState(0);
    const [closePage, setClosePage] = useState(0);
    
    const ITEMS_PER_PAGE = 5;

    // Form for adding new correct answer
    const addCorrectForm = useForm(
        {
            title: 'Add Correct Answer',
            fields: [
                {
                    name: 'answer',
                    label: 'Answer',
                    type: 'string',
                    required: true,
                    helpText: 'Enter a synonym or variation',
                },
            ],
            acceptLabel: 'Add',
        },
        (values) => {
            if (values?.answer) {
                const val = (values.answer as string).trim().toLowerCase();
                if (val && !correctAnswers.includes(val)) {
                    setCorrectAnswers([...correctAnswers, val]);
                }
            }
        }
    );

    // Form for adding new close answer
    const addCloseForm = useForm(
        {
            title: 'Add Close Answer',
            fields: [
                {
                    name: 'answer',
                    label: 'Answer',
                    type: 'string',
                    required: true,
                    helpText: 'Enter a related word',
                },
            ],
            acceptLabel: 'Add',
        },
        (values) => {
            if (values?.answer) {
                const val = (values.answer as string).trim().toLowerCase();
                if (val && !closeAnswers.includes(val)) {
                    setCloseAnswers([...closeAnswers, val]);
                }
            }
        }
    );

    // Form for editing answer
    const editForm = useForm(
        {
            title: 'Edit Answer',
            fields: [
                {
                    name: 'answer',
                    label: 'Answer',
                    type: 'string',
                    required: true,
                },
            ],
            acceptLabel: 'Save',
        },
        (values) => {
            if (values?.answer && editingIndex) {
                const val = (values.answer as string).trim().toLowerCase();
                if (val) {
                    if (editingIndex.type === 'correct') {
                        const newArr = [...correctAnswers];
                        newArr[editingIndex.index] = val;
                        setCorrectAnswers(newArr);
                    } else {
                        const newArr = [...closeAnswers];
                        newArr[editingIndex.index] = val;
                        setCloseAnswers(newArr);
                    }
                }
                setEditingIndex(null);
            }
        }
    );

    const removeCorrect = (index: number) => {
        const newArr = [...correctAnswers];
        newArr.splice(index, 1);
        setCorrectAnswers(newArr);
    };

    const removeClose = (index: number) => {
        const newArr = [...closeAnswers];
        newArr.splice(index, 1);
        setCloseAnswers(newArr);
    };

    const editAnswer = (type: 'correct' | 'close', index: number) => {
        setEditingIndex({ type, index });
        context.ui.showForm(editForm);
    };

    // Pagination helpers
    const correctTotalPages = Math.ceil(correctAnswers.length / ITEMS_PER_PAGE);
    const closeTotalPages = Math.ceil(closeAnswers.length / ITEMS_PER_PAGE);
    
    const correctStart = correctPage * ITEMS_PER_PAGE;
    const correctEnd = correctStart + ITEMS_PER_PAGE;
    const correctPageItems = correctAnswers.slice(correctStart, correctEnd);
    
    const closeStart = closePage * ITEMS_PER_PAGE;
    const closeEnd = closeStart + ITEMS_PER_PAGE;
    const closePageItems = closeAnswers.slice(closeStart, closeEnd);

    return (
        <vstack width="100%" height="100%" backgroundColor={BG_PRIMARY} padding="small" gap="small">
            {/* Header */}
            <vstack alignment="center middle" gap="none">
                <text size="large" weight="bold">Review AI Answers</text>
                <text size="xsmall" color="#666666">Edit, add, or remove answers</text>
            </vstack>

            {/* 2-Column Layout */}
            <hstack grow gap="small" width="100%">
                {/* Correct Answers Column */}
                <vstack grow gap="small" width="50%">
                    <hstack padding="xsmall" backgroundColor="#E8F5E9" cornerRadius="small" alignment="middle">
                        <vstack gap="none" grow>
                            <text size="small" weight="bold" color="#2E7D32">✅ Correct ({correctAnswers.length})</text>
                            <text size="xsmall" color="#1B5E20">Exact matches</text>
                        </vstack>
                        <button
                            appearance="secondary"
                            size="small"
                            icon="add"
                            onPress={() => context.ui.showForm(addCorrectForm)}
                        />
                    </hstack>

                    {/* Fixed height list */}
                    <vstack gap="small" height="200px">
                        {correctPageItems.map((ans, i) => {
                            const actualIndex = correctStart + i;
                            return (
                                <hstack
                                    key={`correct-${actualIndex}`}
                                    alignment="middle"
                                    gap="small"
                                >
                                    <text size="small" color="#1B5E20" grow>{ans}</text>
                                    <button
                                        appearance="secondary"
                                        size="small"
                                        icon="edit"
                                        onPress={() => editAnswer('correct', actualIndex)}
                                    />
                                    <button
                                        appearance="destructive"
                                        size="small"
                                        icon="delete"
                                        onPress={() => removeCorrect(actualIndex)}
                                    />
                                </hstack>
                            );
                        })}
                    </vstack>

                    {/* Pagination */}
                    {correctTotalPages > 1 && (
                        <hstack alignment="center middle" gap="small">
                            <button
                                appearance="secondary"
                                size="small"
                                icon="caret-left"
                                disabled={correctPage === 0}
                                onPress={() => setCorrectPage(correctPage - 1)}
                            />
                            <text size="xsmall" color="#666666">
                                {correctPage + 1} / {correctTotalPages}
                            </text>
                            <button
                                appearance="secondary"
                                size="small"
                                icon="caret-right"
                                disabled={correctPage >= correctTotalPages - 1}
                                onPress={() => setCorrectPage(correctPage + 1)}
                            />
                        </hstack>
                    )}
                </vstack>

                {/* Close Answers Column */}
                <vstack grow gap="small" width="50%">
                    <hstack padding="xsmall" backgroundColor="#FFF3E0" cornerRadius="small" alignment="middle">
                        <vstack gap="none" grow>
                            <text size="small" weight="bold" color="#F57C00">⚠️ Close ({closeAnswers.length})</text>
                            <text size="xsmall" color="#E65100">Hints</text>
                        </vstack>
                        <button
                            appearance="secondary"
                            size="small"
                            icon="add"
                            onPress={() => context.ui.showForm(addCloseForm)}
                        />
                    </hstack>

                    {/* Fixed height list */}
                    <vstack gap="small" height="200px">
                        {closePageItems.map((ans, i) => {
                            const actualIndex = closeStart + i;
                            return (
                                <hstack
                                    key={`close-${actualIndex}`}
                                    alignment="middle"
                                    gap="small"
                                >
                                    <text size="small" color="#E65100" grow>{ans}</text>
                                    <button
                                        appearance="secondary"
                                        size="small"
                                        icon="edit"
                                        onPress={() => editAnswer('close', actualIndex)}
                                    />
                                    <button
                                        appearance="destructive"
                                        size="small"
                                        icon="delete"
                                        onPress={() => removeClose(actualIndex)}
                                    />
                                </hstack>
                            );
                        })}
                    </vstack>

                    {/* Pagination */}
                    {closeTotalPages > 1 && (
                        <hstack alignment="center middle" gap="small">
                            <button
                                appearance="secondary"
                                size="small"
                                icon="caret-left"
                                disabled={closePage === 0}
                                onPress={() => setClosePage(closePage - 1)}
                            />
                            <text size="xsmall" color="#666666">
                                {closePage + 1} / {closeTotalPages}
                            </text>
                            <button
                                appearance="secondary"
                                size="small"
                                icon="caret-right"
                                disabled={closePage >= closeTotalPages - 1}
                                onPress={() => setClosePage(closePage + 1)}
                            />
                        </hstack>
                    )}
                </vstack>
            </hstack>

            {/* Action Buttons */}
            <vstack gap="small">
                <button
                    appearance="primary"
                    size="medium"
                    onPress={() => onConfirm({ correct: correctAnswers, close: closeAnswers })}
                >
                    ✓ Confirm & Create
                </button>

                <button
                    appearance="secondary"
                    size="small"
                    onPress={onCancel}
                >
                    ← Back to Form
                </button>
            </vstack>
        </vstack>
    );
};
