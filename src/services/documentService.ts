import { supabase } from '../lib/supabase';

export interface RestoreDocumentResult {
  success: boolean;
  restoredUrl?: string;
  error?: string;
}

export const restoreOriginalDocument = async (permitId: string): Promise<RestoreDocumentResult> => {
  try {
    const { data: toSignDoc, error: fetchError } = await supabase
      .from('permit_documents')
      .select('id, file_url, original_document_url, file_name')
      .eq('permit_id', permitId)
      .eq('document_type', 'to_sign')
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching to_sign document:', fetchError);
      return { success: false, error: 'Failed to fetch document' };
    }

    if (!toSignDoc) {
      return { success: true };
    }

    if (!toSignDoc.original_document_url) {
      return { success: true, restoredUrl: toSignDoc.file_url };
    }

    if (toSignDoc.file_url !== toSignDoc.original_document_url) {
      const currentPath = extractStoragePath(toSignDoc.file_url);
      if (currentPath && !currentPath.includes('/originals/')) {
        await supabase.storage.from('permit-pdfs').remove([currentPath]);
      }
    }

    const { error: updateError } = await supabase
      .from('permit_documents')
      .update({ file_url: toSignDoc.original_document_url })
      .eq('id', toSignDoc.id);

    if (updateError) {
      console.error('Error updating document URL:', updateError);
      return { success: false, error: 'Failed to restore document URL' };
    }

    return { success: true, restoredUrl: toSignDoc.original_document_url };
  } catch (error) {
    console.error('Error in restoreOriginalDocument:', error);
    return { success: false, error: 'Unexpected error restoring document' };
  }
};

export const clearPermitSignatures = async (permitId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('permits')
      .update({
        signed_document_url: null,
        signed_pdf_url: null,
        signature_data_url: null,
        signature_image_url: null,
        signed_by: null,
        signed_at: null,
        qp_approved_at: null,
        qp_approved_by: null,
        approver_approved_at: null,
        approved_by: null,
      })
      .eq('id', permitId);

    if (error) {
      console.error('Error clearing signatures:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in clearPermitSignatures:', error);
    return false;
  }
};

export const deleteOldOriginalAndUploadNew = async (
  permitId: string,
  newFile: File
): Promise<{ workingUrl: string; originalUrl: string } | null> => {
  try {
    console.log('[deleteOldOriginalAndUploadNew] Starting for permit:', permitId, 'file:', newFile.name);

    const { data: existingDocs, error: fetchError } = await supabase
      .from('permit_documents')
      .select('id, file_url, original_document_url')
      .eq('permit_id', permitId)
      .eq('document_type', 'to_sign');

    console.log('[deleteOldOriginalAndUploadNew] Found existing docs:', existingDocs?.length || 0, existingDocs);

    if (fetchError) {
      console.error('[deleteOldOriginalAndUploadNew] Error fetching existing documents:', fetchError);
      return null;
    }

    if (existingDocs && existingDocs.length > 0) {
      const pathsToDelete: string[] = [];

      for (const doc of existingDocs) {
        if (doc.file_url) {
          const currentPath = extractStoragePath(doc.file_url);
          if (currentPath && !pathsToDelete.includes(currentPath)) {
            pathsToDelete.push(currentPath);
          }
        }
        if (doc.original_document_url) {
          const originalPath = extractStoragePath(doc.original_document_url);
          if (originalPath && !pathsToDelete.includes(originalPath)) {
            pathsToDelete.push(originalPath);
          }
        }
      }

      console.log('[deleteOldOriginalAndUploadNew] Deleting storage paths:', pathsToDelete);

      if (pathsToDelete.length > 0) {
        const { error: storageDeleteError } = await supabase.storage.from('permit-pdfs').remove(pathsToDelete);
        if (storageDeleteError) {
          console.error('[deleteOldOriginalAndUploadNew] Storage delete error:', storageDeleteError);
        }
      }

      console.log('[deleteOldOriginalAndUploadNew] Deleting DB records for permit:', permitId);
      const { error: deleteError } = await supabase
        .from('permit_documents')
        .delete()
        .eq('permit_id', permitId)
        .eq('document_type', 'to_sign');

      if (deleteError) {
        console.error('[deleteOldOriginalAndUploadNew] DB delete error:', deleteError);
      } else {
        console.log('[deleteOldOriginalAndUploadNew] DB records deleted successfully');
      }
    }

    const timestamp = Date.now();
    const workingFilePath = `permit-documents/${permitId}/${timestamp}_${newFile.name}`;
    const originalFilePath = `permit-documents/${permitId}/originals/${timestamp}_${newFile.name}`;

    const { error: workingUploadError } = await supabase.storage
      .from('permit-pdfs')
      .upload(workingFilePath, newFile, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (workingUploadError) {
      console.error('Error uploading working file:', workingUploadError);
      return null;
    }

    const { error: originalUploadError } = await supabase.storage
      .from('permit-pdfs')
      .upload(originalFilePath, newFile, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (originalUploadError) {
      console.error('Error uploading original backup:', originalUploadError);
    }

    const { data: workingUrlData } = supabase.storage
      .from('permit-pdfs')
      .getPublicUrl(workingFilePath);

    const { data: originalUrlData } = supabase.storage
      .from('permit-pdfs')
      .getPublicUrl(originalFilePath);

    console.log('[deleteOldOriginalAndUploadNew] Inserting new document record:', workingUrlData.publicUrl);
    const { error: insertError } = await supabase
      .from('permit_documents')
      .insert({
        permit_id: permitId,
        document_type: 'to_sign',
        file_name: newFile.name,
        file_url: workingUrlData.publicUrl,
        original_document_url: originalUrlData.publicUrl,
        uploaded_after_approval: false,
      });

    if (insertError) {
      console.error('[deleteOldOriginalAndUploadNew] Error inserting new document record:', insertError);
      return null;
    }

    console.log('[deleteOldOriginalAndUploadNew] Success! New document URL:', workingUrlData.publicUrl);
    return {
      workingUrl: workingUrlData.publicUrl,
      originalUrl: originalUrlData.publicUrl,
    };
  } catch (error) {
    console.error('Error in deleteOldOriginalAndUploadNew:', error);
    return null;
  }
};

const extractStoragePath = (publicUrl: string): string | null => {
  try {
    const match = publicUrl.match(/permit-pdfs\/(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};
