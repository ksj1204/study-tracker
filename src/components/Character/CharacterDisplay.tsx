import { motion } from 'framer-motion';
import type { CharacterStage, RainbowColor } from '@/types/database';
import { 
  getStageEmoji, 
  getStageName, 
  getMoodEmoji, 
  getColorHex,
  getColorName 
} from '@/lib/characterUtils';

interface CharacterDisplayProps {
  stage: CharacterStage;
  color: RainbowColor;
  moodLevel: number;
  consecutiveDays: number;
}

export default function CharacterDisplay({ 
  stage, 
  color, 
  moodLevel, 
  consecutiveDays 
}: CharacterDisplayProps) {
  const stageEmoji = getStageEmoji(stage);
  const stageName = getStageName(stage);
  const moodEmoji = getMoodEmoji(moodLevel);
  const colorHex = getColorHex(color);
  const colorName = getColorName(color);

  return (
    <div className="flex flex-col items-center">
      {/* 캐릭터 */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className="relative"
      >
        {/* 색상 배경 원 */}
        <div 
          className="absolute inset-0 rounded-full opacity-20 blur-xl"
          style={{ backgroundColor: colorHex }}
        />
        
        {/* 캐릭터 이모지 */}
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          className="text-7xl relative z-10"
          style={{ filter: `drop-shadow(0 0 20px ${colorHex}40)` }}
        >
          {stageEmoji}
        </motion.div>
        
        {/* 표정 뱃지 */}
        <div className="absolute -right-2 -bottom-1 text-2xl bg-white rounded-full p-1 shadow-md">
          {moodEmoji}
        </div>
      </motion.div>

      {/* 정보 */}
      <div className="mt-4 text-center">
        <h3 className="text-xl font-bold text-gray-800">
          {stageName}
        </h3>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span 
            className="px-2 py-0.5 rounded-full text-sm font-medium text-white"
            style={{ backgroundColor: colorHex }}
          >
            {colorName}
          </span>
          <span className="text-gray-500 text-sm">
            감정 {moodLevel}%
          </span>
        </div>
      </div>

      {/* 연속 출석 */}
      {consecutiveDays > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 px-4 py-2 bg-chick-100 rounded-full"
        >
          <span className="text-chick-700 font-medium">
            🔥 연속 {consecutiveDays}일째!
          </span>
        </motion.div>
      )}
    </div>
  );
}
