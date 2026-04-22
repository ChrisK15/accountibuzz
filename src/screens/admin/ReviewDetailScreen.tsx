/**
 * ReviewDetailScreen.tsx
 * Full-screen view of a single pending submission. Admins can:
 *   - Approve (SCRUM-26): marks submission approved, member gets streak credit
 *   - Request Resubmission (SCRUM-27): marks rejected with a feedback note
 *   - Flag (SCRUM-28): marks flagged with a note for integrity violations
 * Feedback note is entered via a Modal + TextInput before confirming.
 */

import React, { useState } from 'react'
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { AdminStackParamList } from '@/types/navigation'
import { useReviewQueue } from '@/hooks/useReviewQueue'
import VideoPlayer from '@/components/submissions/VideoPlayer'
import { COLORS } from '@/utils/constants'

type Props = {
  navigation: NativeStackNavigationProp<AdminStackParamList, 'ReviewDetail'>
  route: RouteProp<AdminStackParamList, 'ReviewDetail'>
}

type NoteModalAction = 'resubmit' | 'flag' | null

export default function ReviewDetailScreen({ navigation, route }: Props) {
  const { submissionId, groupId } = route.params
  const { submissions, isLoading, approve, requestResubmission, flag } = useReviewQueue(groupId)
  const submission = submissions.find(s => s.id === submissionId)

  const [modalAction, setModalAction] = useState<NoteModalAction>(null)
  const [note, setNote] = useState('')
  const [isActing, setIsActing] = useState(false)

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.textSecondary} />
      </View>
    )
  }

  // Submission may have been removed from queue (approved/flagged elsewhere).
  if (!submission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.gone}>This submission has already been reviewed.</Text>
      </View>
    )
  }

  const isVideo = submission.mediaType === 'video'
  const time = submission.submittedAt?.toDate().toLocaleString() ?? 'Unknown time'

  async function handleApprove() {
    setIsActing(true)
    await approve(submissionId)
    navigation.goBack()
  }

  async function handleConfirmNote() {
    setIsActing(true)
    if (modalAction === 'resubmit') {
      await requestResubmission(submissionId, note)
    } else if (modalAction === 'flag') {
      await flag(submissionId, note)
    }
    setModalAction(null)
    setNote('')
    navigation.goBack()
  }

  return (
    <View style={styles.container}>
      {/* Media */}
      <View style={styles.media}>
        {isVideo
          ? <VideoPlayer uri={submission.mediaUrl} style={styles.mediaInner} />
          : <Image source={{ uri: submission.mediaUrl }} style={styles.mediaInner} resizeMode="contain" />
        }
      </View>

      {/* Info + actions */}
      <View style={styles.panel}>
        <Text style={styles.meta}>Submitted: {time}</Text>
        <Text style={styles.meta}>User: {submission.displayName || submission.userId.slice(0, 16)}</Text>

        {isActing ? (
          <ActivityIndicator color={COLORS.success} style={{ marginTop: 16 }} />
        ) : (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.approveBtn} onPress={handleApprove}>
              <Text style={styles.approveBtnText}>✓ Approve</Text>
            </TouchableOpacity>
            <View style={styles.secondaryRow}>
              <TouchableOpacity style={styles.resubmitBtn} onPress={() => setModalAction('resubmit')}>
                <Text style={styles.resubmitBtnText}>↩ Request Resubmission</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.flagBtn} onPress={() => setModalAction('flag')}>
                <Text style={styles.flagBtnText}>⚑ Flag</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Note modal for resubmit / flag */}
      <Modal visible={modalAction !== null} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {modalAction === 'resubmit' ? 'Feedback for member' : 'Flag reason'}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder={modalAction === 'resubmit'
                ? 'Explain what needs to be corrected…'
                : 'Describe the integrity concern…'}
              placeholderTextColor={COLORS.textMuted}
              value={note}
              onChangeText={setNote}
              multiline
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setModalAction(null); setNote('') }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, !note.trim() && styles.modalConfirmDisabled]}
                onPress={handleConfirmNote}
                disabled={!note.trim()}
              >
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  gone: { color: COLORS.textSecondary, fontSize: 15, textAlign: 'center' },
  media: { flex: 1 },
  mediaInner: { flex: 1, width: '100%' },
  panel: { backgroundColor: COLORS.bgPrimary, padding: 20, gap: 6 },
  meta: { color: COLORS.textSecondary, fontSize: 13 },
  actions: { marginTop: 12, gap: 10 },
  approveBtn: {
    backgroundColor: COLORS.success, borderRadius: 10,
    padding: 16, alignItems: 'center',
  },
  approveBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  secondaryRow: { flexDirection: 'row', gap: 10 },
  resubmitBtn: {
    flex: 1, borderWidth: 1, borderColor: COLORS.warning,
    borderRadius: 10, padding: 14, alignItems: 'center',
  },
  resubmitBtnText: { color: COLORS.warning, fontWeight: '600', fontSize: 14 },
  flagBtn: {
    flex: 1, borderWidth: 1, borderColor: COLORS.error,
    borderRadius: 10, padding: 14, alignItems: 'center',
  },
  flagBtnText: { color: COLORS.error, fontWeight: '600', fontSize: 14 },
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalCard: {
    backgroundColor: COLORS.bgSurface, borderTopLeftRadius: 20,
    borderTopRightRadius: 20, padding: 24, gap: 16,
  },
  modalTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '600' },
  modalInput: {
    backgroundColor: COLORS.bgElevated, borderRadius: 10,
    padding: 14, color: COLORS.textPrimary, fontSize: 15,
    minHeight: 100, textAlignVertical: 'top',
  },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalCancel: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 14, alignItems: 'center',
  },
  modalCancelText: { color: COLORS.textSecondary, fontWeight: '600' },
  modalConfirm: {
    flex: 1, backgroundColor: COLORS.success,
    borderRadius: 10, padding: 14, alignItems: 'center',
  },
  modalConfirmDisabled: { opacity: 0.4 },
  modalConfirmText: { color: '#fff', fontWeight: 'bold' },
})
