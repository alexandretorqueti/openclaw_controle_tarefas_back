// @ts-nocheck
// File: src/services/avatarService.ts

import fs from './fs';
import path from './path';
import * as Logger from '../utils/logger';
import express from 'express';

export const AvatarService = {
  async getFile(id) {
    try {
      const response = await fetch(API_URL + `/avatars/${id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        success: true,
        data: data,
        error: null
      };
    } catch (error) {
      Logger.error(`Failed to fetch avatar file ${id}: ${error.message}`);
      
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  },
  
  async uploadAvatar(userId: string, file: express.Multer.File, image: any) {
    try {
      const response = await fetch(API_URL + `/avatars/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: userId,
          imageData: image || file.buffer.toString('base64')
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        success: true,
        message: data.message || 'Avatar uploaded successfully',
        avatar: data.avatar
      };
    } catch (error) {
      Logger.error(`Failed to upload avatar: ${error.message}`);
      
      return {
        success: false,
        message: error.message
      };
    }
  }
};
